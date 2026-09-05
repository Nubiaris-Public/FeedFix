# Official source artifact (local only)

Place the Walmart Marketplace MP_ITEM JSON downloaded from your authorized Walmart source here, or pass its existing absolute path to the CLI. Do not commit it or place it in public/. The source discovered for this integration is `src/5.0.20260703-18_22_27-api_MP_ITEM_0_0_en.json`; it is explicitly excluded from Git and Docker. The compiler reads it offline using streaming tokens. No LLM or runtime request receives the source.

Run `npm run walmart:schema:inspect -- --input <path>`, then `npm run walmart:schema:compile -- --input <path> --output data/walmart/compiled/<version>` and `npm run walmart:schema:verify -- --input <path> --compiled data/walmart/compiled/<version>`.
