import type { PlasmoMessaging } from "@plasmohq/messaging";
import { tabScreenshots } from "../index";
import type { TabScreenshot } from "../types";

export type RequestBody = {
  screenshot: string;
};

export type ResponseBody = {
  success: boolean;
};

const handler: PlasmoMessaging.MessageHandler<
  RequestBody,
  ResponseBody
> = async (req, res) => {
  if (!req.sender?.tab?.id) {
    console.error("Received message without sender tab ID");
    res.send({ success: false });
    return;
  }

  if (!req.body?.screenshot) {
    console.error("Received store screenshot request without screenshot data");
    res.send({ success: false });
    return;
  }

  tabScreenshots.set(req.sender.tab.id, {
    screenshot: req.body.screenshot,
    timestamp: Date.now(),
  });

  res.send({ success: true });
};

export default handler; 