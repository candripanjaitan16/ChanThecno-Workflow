import { app } from "./app.js";
app.listen(process.env.PORT || 3001, "127.0.0.1", () =>
  console.log("ChanThecno API listening on http://127.0.0.1:3001"),
);
