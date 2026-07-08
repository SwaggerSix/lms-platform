import { MapPin, Video, Users } from "lucide-react";
import type {
  ILTSessionStatus,
  AttendanceStatus,
  ILTLocationType,
} from "@/types/database";

export interface SessionItem {
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  description: string;
  instructor_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: ILTLocationType;
  location_details: string;
  meeting_url: string | null;
  meeting_provider: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
  recording_url: string | null;
  max_capacity: number;
  registered_count: number;
  status: ILTSessionStatus;
  attendees: AttendeeItem[];
}

export interface AttendeeItem {
  id: string;
  name: string;
  email: string;
  attendance_status: AttendanceStatus | null;
  check_in_time: string | null;
  notes: string;
}

export interface CourseOption {
  id: string;
  title: string;
}

export interface InstructorOption {
  id: string;
  name: string;
}

export const STATUS_CONFIG: Record<ILTSessionStatus, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

export const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
  { value: "no_show", label: "No Show" },
];

export const LOCATION_ICONS: Record<ILTLocationType, typeof MapPin> = {
  virtual: Video,
  in_person: MapPin,
  hybrid: Users,
};

export const PROVIDER_OPTIONS = [
  { value: "", label: "No provider" },
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "google_meet", label: "Google Meet" },
  { value: "custom", label: "Custom URL" },
] as const;

export const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  zoom: { label: "Zoom", color: "bg-blue-100 text-blue-700" },
  teams: { label: "Teams", color: "bg-purple-100 text-purple-700" },
  google_meet: { label: "Meet", color: "bg-green-100 text-green-700" },
  custom: { label: "Custom", color: "bg-gray-100 text-gray-600" },
};
