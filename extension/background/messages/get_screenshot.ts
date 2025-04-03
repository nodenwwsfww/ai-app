import type { PlasmoMessaging } from "@plasmohq/messaging";
import { tabScreenshots } from "../index";

export type RequestBody = {}; // No body needed for this request

export type ResponseBody = {
  screenshot?: string;
};

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!req.sender?.tab?.id) {
    console.error("Received get screenshot request without sender tab ID");
    res.send({}); // Send empty response
    return;
  }

  const data = tabScreenshots.get(req.sender.tab.id);
  res.send({ screenshot: data?.screenshot });
};

export default handler; 