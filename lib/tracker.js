"use client";
 
export async function track(event, data = {}) {
  try {
    let sessionId = sessionStorage.getItem("sm_session");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("sm_session", sessionId);
    }
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, event, ...data }),
    });
  } catch (err) {
    // silent fail — tracking must never break the app
  }
}





// export async function track(event, data = {}) {

//   try {

//     let sessionId = sessionStorage.getItem("sm_session");

//     if (!sessionId) {

//       sessionId = crypto.randomUUID();

//       sessionStorage.setItem("sm_session", sessionId);

//     }

//     await fetch("/api/events", {

//       method: "POST",

//       headers: {
//         "Content-Type": "application/json",
//       },

//       body: JSON.stringify({

//         session_id: sessionId,

//         event,

//         ...data,

//       }),

//     });

//   } catch (err) {

//     console.error("Tracking Error:", err);

//   }

// }

// // console.log("TRACKER FILE LOADED");

// // export async function track(event, data = {}) {
// //   console.log("TRACK FUNCTION CALLED:", event);

// //   return true;
// // }