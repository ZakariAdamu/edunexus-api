import { Inngest } from "inngest";
import { env } from "../config/env.ts";

// Local sends go to the Inngest dev server (http://localhost:8288).
// Production sends go to Inngest Cloud and need INNGEST_EVENT_KEY.
export const inngest = new Inngest({
	id: "sms-lms",
	isDev: env.nodeEnv !== "production",
});

// Create an empty array where we'll export future Inngest functions

export const functions = [];
