import type { PlasmoMessaging } from "@plasmohq/messaging";
import { tabScreenshots } from "../index";

export type RequestBody = {}; // No body needed

export type ResponseBody = {
  hasScreenshot: boolean;
};

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!req.sender?.tab?.id) {
    console.error("Received has screenshot request without sender tab ID");
    res.send({ hasScreenshot: false });
    return;
  }

  res.send({ hasScreenshot: tabScreenshots.has(req.sender.tab.id) });
};

export default handler; 