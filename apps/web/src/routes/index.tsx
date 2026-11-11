import { createFileRoute } from "@tanstack/react-router";
import { PrototypeList } from "@/components/prototype/PrototypeList";

export const Route = createFileRoute("/")({ component: PrototypeList });
