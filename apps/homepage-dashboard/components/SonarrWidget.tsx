import { ArrQueueWidget } from "./ArrQueueWidget";

export function SonarrWidget() {
  return <ArrQueueWidget title="Sonarr" endpoint="/api/sonarr/summary" />;
}
