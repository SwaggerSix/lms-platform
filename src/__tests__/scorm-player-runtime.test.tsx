import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { SCORMPlayer } from "@/components/course/scorm-player";
import { EMPTY_RUNTIME_STATE } from "@/lib/scorm/package";

type Api = Record<string, (...a: string[]) => string>;
const api12 = () => (window as any).API as Api;
const api2004 = () => (window as any).API_1484_11 as Api;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(props: Partial<Parameters<typeof SCORMPlayer>[0]> = {}) {
  const onComplete = vi.fn();
  const onPersist = vi.fn();
  const utils = render(
    <SCORMPlayer
      packageUrl="/scorm-content/123e4567-e89b-42d3-a456-426614174000/index.html"
      title="Test"
      learnerName="Doe, Jane"
      learnerId="u1"
      onComplete={onComplete}
      onPersist={onPersist}
      {...props}
    />
  );
  return { ...utils, onComplete, onPersist };
}

describe("SCORM runtime", () => {
  it("exposes both APIs and keeps the same object across updates", () => {
    mount();
    const first = api12();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.lesson_location", "slide-3");
    });
    expect(api12()).toBe(first);
    expect(api12().LMSGetValue("cmi.core.lesson_location")).toBe("slide-3");
    expect(api12().LMSGetValue("cmi.core.student_name")).toBe("Doe, Jane");
  });

  it("reports SCORM 1.2 completion as soon as status is set (no Finish needed)", () => {
    const { onComplete } = mount();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.lesson_status", "passed");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    act(() => {
      api12().LMSSetValue("cmi.core.lesson_status", "completed");
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reports SCORM 2004 completion via completion_status or success_status", () => {
    const a = mount();
    act(() => {
      api2004().Initialize("");
      api2004().SetValue("cmi.completion_status", "completed");
    });
    expect(a.onComplete).toHaveBeenCalledTimes(1);
    cleanup();

    const b = mount();
    act(() => {
      api2004().Initialize("");
      api2004().SetValue("cmi.success_status", "passed");
    });
    expect(b.onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not re-report a lesson the LMS already has as complete", () => {
    const { onComplete } = mount({ alreadyCompleted: true });
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.lesson_status", "completed");
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("resumes from saved state", () => {
    mount({
      initialState: {
        ...EMPTY_RUNTIME_STATE,
        location: "slide-9",
        suspendData: "abc",
        lessonStatus: "incomplete",
        totalTimeSeconds: 125,
      },
    });
    act(() => {
      api12().LMSInitialize("");
    });
    expect(api12().LMSGetValue("cmi.core.entry")).toBe("resume");
    expect(api12().LMSGetValue("cmi.suspend_data")).toBe("abc");
    expect(api12().LMSGetValue("cmi.core.lesson_location")).toBe("slide-9");
    expect(api12().LMSGetValue("cmi.core.total_time")).toBe("0000:02:05.00");
    expect(api2004().GetValue("cmi.entry")).toBe("resume");
  });

  it("starts fresh without saved state and errors before Initialize", () => {
    mount();
    expect(api12().LMSGetValue("cmi.core.lesson_status")).toBe("");
    expect(api12().LMSGetLastError("")).toBe("301");
    act(() => {
      api12().LMSInitialize("");
    });
    expect(api12().LMSGetValue("cmi.core.entry")).toBe("ab-initio");
    expect(api12().LMSGetValue("cmi.core.lesson_status")).toBe("incomplete");
  });

  it("throttles commits and saves accumulated session time", () => {
    vi.useFakeTimers();
    const { onPersist } = mount({ initialState: { ...EMPTY_RUNTIME_STATE, totalTimeSeconds: 60 } });
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.session_time", "0000:01:30.00");
      api12().LMSSetValue("cmi.suspend_data", "x");
      api12().LMSCommit("");
      api12().LMSCommit("");
    });
    expect(onPersist).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onPersist).toHaveBeenCalledTimes(1);
    const [state, final] = onPersist.mock.calls[0];
    expect(final).toBe(false);
    expect(state.suspendData).toBe("x");
    expect(state.totalTimeSeconds).toBe(150);
  });

  it("persists on Finish and clears the bookmark after a completed, non-suspended attempt", () => {
    const { onPersist } = mount();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.lesson_location", "end");
      api12().LMSSetValue("cmi.core.lesson_status", "completed");
      api12().LMSFinish("");
    });
    const last = onPersist.mock.calls.at(-1)![0];
    expect(last.lessonStatus).toBe("completed");
    expect(last.location).toBe("");
  });

  it("keeps the bookmark when an incomplete attempt finishes", () => {
    const { onPersist } = mount();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.core.lesson_location", "slide-4");
      api12().LMSSetValue("cmi.core.exit", "");
      api12().LMSFinish("");
    });
    expect(onPersist.mock.calls.at(-1)![0].location).toBe("slide-4");
  });

  it("flushes a final save on unmount and removes the globals", () => {
    const { onPersist, unmount } = mount();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.suspend_data", "y");
    });
    unmount();
    expect(onPersist).toHaveBeenLastCalledWith(expect.objectContaining({ suspendData: "y" }), true);
    expect((window as any).API).toBeUndefined();
    expect((window as any).API_1484_11).toBeUndefined();
  });

  it("tracks interaction counts for unknown elements", () => {
    mount();
    act(() => {
      api12().LMSInitialize("");
      api12().LMSSetValue("cmi.interactions.0.id", "q1");
      api12().LMSSetValue("cmi.interactions.1.id", "q2");
    });
    expect(api12().LMSGetValue("cmi.interactions._count")).toBe("2");
    expect(api12().LMSGetValue("cmi.objectives._count")).toBe("0");
  });
});
