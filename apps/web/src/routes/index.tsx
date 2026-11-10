import { createFileRoute } from "@tanstack/react-router";
import { ApiStatus } from "@/components/system/ApiStatus";

export const Route = createFileRoute("/")({ component: ApiStatus });
