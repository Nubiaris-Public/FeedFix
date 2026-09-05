import FeedFix from "./utility";
import { config } from "../server/config";
export const dynamic = "force-dynamic";
export default function Home() {
  const c = config();
  return (
    <FeedFix
      amount={c.amount}
      maxUpload={c.maxUpload}
      demo={!process.env.SCHEMA_PATH}
      mock={c.mock}
    />
  );
}
