import { ArrQueueWidget } from "./ArrQueueWidget";

export function RadarrWidget() {
  return <ArrQueueWidget title="Radarr" endpoint="/api/radarr/summary" />;
}
