/**
 * Workflow Automation Engine
 * Executes workflows step-by-step, logging results and managing state.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { evaluateCondition, type Condition } from "./conditions";

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_type: "condition" | "action" | "delay" | "branch" | "loop";
  step_config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  next_step_id: string | null;
  true_step_id: string | null;
  false_step_id: string | null;
  sequence_order: number;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  trigger_data: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface StepResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  nextStepId?: string | null;
}

export interface WorkflowContext {
  triggerData: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  runId: string;
}

// ── Action handlers ─────────────────────────────────────────────────────────

type ActionHandler = (
  config: Record<string, unknown>,
  context: WorkflowContext
) => Promise<StepResult>;

const actionHandlers: Record<string, ActionHandler> = {
  send_email: async (config, _ctx) => {
    // In production this would integrate with an email service
    console.log(`[Workflow] Send email to: ${config.to}, subject: ${config.subject}`);
    return {
      success: true,
      output: { sent_to: config.to, subject: config.subject, sent_at: new Date().toISOString() },
    };
  },

  send_notification: async (config, _ctx) => {
    const service = createServiceClient();
    const { error } = await service.from("notifications").insert({
      user_id: config.user_id,
      title: config.title || "Workflow Notification",
      body: config.body || "",
      type: "workflow",
    });
    if (error) return { success: false, output: {}, error: error.message };
    return { success: true, output: { notified_user: config.user_id } };
  },

  enroll_user: async (config, _ctx) => {
    const service = createServiceClient();
    const { data, error } = await service
      .from("enrollments")
      .insert({
        user_id: config.user_id,
        course_id: config.course_id,
        status: "active",
        enrolled_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { success: false, output: {}, error: error.message };
    return { success: true, output: { enrollment_id: data.id } };
  },

  unenroll_user: async (config, _ctx) => {
    const service = createServiceClient();
    const { error } = await service
      .from("enrollments")
      .update({ status: "dropped" })
      .eq("user_id", config.user_id as string)
      .eq("course_id", config.course_id as string);
    if (error) return { success: false, output: {}, error: error.message };
    return { success: true, output: { unenrolled: true } };
  },

  assign_badge: async (config, _ctx) => {
    const service = createServiceClient();
    const { error } = await service.from("user_badges").insert({
      user_id: config.user_id,
      badge_id: config.badge_id,
      awarded_at: new Date().toISOString(),
    });
    if (error) return { success: false, output: {}, error: error.message };
    return { success: true, output: { badge_assigned: config.badge_id } };
  },

  update_user_field: async (config, _ctx) => {
    const service = createServiceClient();
    const { error } = await service
      .from("users")
      .update({ [config.field as string]: config.value })
      .eq("id", config.user_id as string);
    if (error) return { success: false, output: {}, error: error.message };
    return { success: true, output: { updated_field: config.field, new_value: config.value } };
  },

  create_task: async (config, _ctx) => {
    console.log(`[Workflow] Create task: ${config.title} assigned to ${config.assignee_id}`);
    return {
      success: true,
      output: { task_title: config.title, assignee: config.assignee_id, created_at: new Date().toISOString() },
    };
  },

  webhook_call: async (config, _ctx) => {
    try {
      const response = await fetch(config.url as string, {
        method: (config.method as string) || "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers as Record<string, string> || {}),
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });
      const responseData = await response.text();
      return {
        success: response.ok,
        output: { status: response.status, body: responseData },
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return { success: false, output: {}, error: String(err) };
    }
  },

  delay: async (config, _ctx) => {
    const delayMs = Number(config.duration_ms || config.duration_seconds
      ? Number(config.duration_seconds) * 1000
      : 0);
    if (delayMs > 0 && delayMs <= 30000) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return {
      success: true,
      output: { delayed_ms: delayMs, resumed_at: new Date().toISOString() },
    };
  },
};

// ── Workflow Engine class ───────────────────────────────────────────────────

export class WorkflowEngine {
  private service = createServiceClient();
  private maxRetries = 2;

  /**
   * Execute an entire workflow from start to finish.
   */
  async executeWorkflow(
    workflowId: string,
    triggerData: Record<string, unknown> = {}
  ): Promise<WorkflowRun> {
    // Create run record
    const { data: run, error: runError } = await this.service
      .from("workflow_runs")
      .insert({
        workflow_id: workflowId,
        status: "running",
        trigger_data: triggerData,
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create workflow run: ${runError?.message}`);
    }

    const context: WorkflowContext = {
      triggerData,
      stepOutputs: {},
      variables: { ...triggerData },
      runId: run.id,
    };

    try {
      // Fetch steps ordered by sequence
      const { data: steps } = await this.service
        .from("workflow_steps")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("sequence_order", { ascending: true });

      if (!steps || steps.length === 0) {
        return this.completeRun(run.id, "completed");
      }

      // Build step map for quick lookup
      const stepMap = new Map<string, WorkflowStep>();
      for (const step of steps) {
        stepMap.set(step.id, step as WorkflowStep);
      }

      // Find the first step (lowest sequence_order)
      let currentStep: WorkflowStep | undefined = steps[0] as WorkflowStep;

      while (currentStep) {
        const result = await this.executeStepWithRetry(currentStep, context);

        // Store output
        context.stepOutputs[currentStep.id] = result.output;

        // Determine next step based on result
        let nextStepId: string | null = null;

        if (result.nextStepId !== undefined) {
          nextStepId = result.nextStepId;
        } else if (currentStep.step_type === "condition" || currentStep.step_type === "branch") {
          nextStepId = result.success ? currentStep.true_step_id : currentStep.false_step_id;
        } else {
          nextStepId = currentStep.next_step_id;
        }

        if (!result.success && currentStep.step_type === "action") {
          // Action failed after retries - fail the run
          return this.completeRun(run.id, "failed", result.error);
        }

        currentStep = nextStepId ? stepMap.get(nextStepId) : undefined;
      }

      // Update workflow stats
      await this.service
        .from("workflows")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: (await this.service.from("workflows").select("run_count").eq("id", workflowId).single()).data?.run_count + 1 || 1,
        })
        .eq("id", workflowId);

      return this.completeRun(run.id, "completed");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.completeRun(run.id, "failed", errorMsg);
    }
  }

  /**
   * Execute a single step with retry logic.
   */
  private async executeStepWithRetry(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const logId = await this.createStepLog(context.runId, step.id);

      try {
        await this.updateStepLog(logId, {
          status: "running",
          started_at: new Date().toISOString(),
          input_data: { context_variables: context.variables, attempt },
        });

        const result = await this.executeStep(step, context);

        await this.updateStepLog(logId, {
          status: result.success ? "completed" : "failed",
          completed_at: new Date().toISOString(),
          output_data: result.output,
          error_message: result.error || null,
        });

        if (result.success || step.step_type === "condition" || step.step_type === "branch") {
          return result;
        }

        lastError = result.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        await this.updateStepLog(logId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: lastError,
        });
      }
    }

    return { success: false, output: {}, error: lastError || "Max retries exceeded" };
  }

  /**
   * Execute a single workflow step.
   */
  async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<StepResult> {
    const config = this.resolveConfigVariables(step.step_config, context);

    switch (step.step_type) {
      case "condition":
      case "branch": {
        const condition = config.condition as Condition;
        if (!condition) {
          return { success: true, output: { result: true } };
        }
        const flatContext: Record<string, unknown> = {
          ...context.variables,
          ...context.triggerData,
          ...context.stepOutputs,
        };
        const result = this.evaluateCondition(condition, flatContext);
        return {
          success: result,
          output: { condition_result: result },
        };
      }

      case "delay": {
        const handler = actionHandlers.delay;
        return handler(config, context);
      }

      case "loop": {
        // Loop steps iterate over an array field
        const items = context.variables[config.items_field as string];
        if (!Array.isArray(items)) {
          return { success: true, output: { iterations: 0 } };
        }
        const loopResults: unknown[] = [];
        for (const item of items) {
          context.variables._loop_item = item;
          loopResults.push(item);
        }
        return {
          success: true,
          output: { iterations: loopResults.length, items: loopResults },
        };
      }

      case "action": {
        const actionType = config.action_type as string;
        const handler = actionHandlers[actionType];
        if (!handler) {
          return { success: false, output: {}, error: `Unknown action type: ${actionType}` };
        }
        return handler(config, context);
      }

      default:
        return { success: false, output: {}, error: `Unknown step type: ${step.step_type}` };
    }
  }

  /**
   * Evaluate a condition against context data.
   */
  evaluateCondition(condition: Condition, context: Record<string, unknown>): boolean {
    return evaluateCondition(condition, context);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Replace {{variable}} placeholders in config values with context data.
   */
  private resolveConfigVariables(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    const allVars: Record<string, unknown> = {
      ...context.triggerData,
      ...context.variables,
    };

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string") {
        resolved[key] = value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
          const parts = path.split(".");
          let current: unknown = allVars;
          for (const part of parts) {
            if (current === null || current === undefined || typeof current !== "object") return "";
            current = (current as Record<string, unknown>)[part];
          }
          return current !== undefined && current !== null ? String(current) : "";
        });
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        resolved[key] = this.resolveConfigVariables(value as Record<string, unknown>, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private async completeRun(
    runId: string,
    status: "completed" | "failed" | "cancelled",
    errorMessage?: string
  ): Promise<WorkflowRun> {
    const { data } = await this.service
      .from("workflow_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        error_message: errorMessage || null,
      })
      .eq("id", runId)
      .select()
      .single();

    return data as WorkflowRun;
  }

  private async createStepLog(runId: string, stepId: string): Promise<string> {
    const { data } = await this.service
      .from("workflow_step_logs")
      .insert({ run_id: runId, step_id: stepId, status: "pending" })
      .select("id")
      .single();
    return data!.id;
  }

  private async updateStepLog(logId: string, updates: Record<string, unknown>) {
    await this.service
      .from("workflow_step_logs")
      .update(updates)
      .eq("id", logId);
  }
}
