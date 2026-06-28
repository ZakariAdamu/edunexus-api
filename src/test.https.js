// import https from "https";

// const req = https.request(
//   "https://api.brevo.com/v3/account",
//   {
//     method: "GET",
//     headers: {
//       "api-key": process.env.BREVO_API_KEY,
//     },
//   },
//   (res) => {
//     console.log("STATUS:", res.statusCode);
//   },
// );

// req.on("error", (err) => {
//   console.error("❌ Error:", err);
// });

// req.end();