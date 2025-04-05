import { describe, it, expect, vi, beforeEach } from "vitest";
import type OpenAI from "openai";
import { getOpenRouterChatCompletion } from "./openrouter";

describe("getOpenRouterChatCompletion", () => {
  // Mock OpenAI client
  const mockCreate = vi.fn();
  const mockOpenAI = {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  } as unknown as OpenAI;

  // Reset mocks between tests
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "mock response",
          },
        },
      ],
    });
  });

  it("should handle text-only requests correctly", async () => {
    // Setup
    const modelName = "test-model";
    const existingText = "test text";
    const url = "https://example.com";
    const userCountry = "TestCountry";
    const userCity = "TestCity";

    // Execute
    await getOpenRouterChatCompletion(
      mockOpenAI,
      modelName,
      existingText,
      url,
      undefined,
      undefined,
      undefined,
      userCountry,
      userCity
    );

    // Verify
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArg = mockCreate.mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string | unknown[] }>;
    };

    expect(callArg.model).toBe(modelName);
    expect(callArg.messages.length).toBe(2);
    expect(callArg.messages[0].role).toBe("system");
    expect(callArg.messages[1].role).toBe("user");
    expect(typeof callArg.messages[1].content).toBe("string");
  });

  it("should handle screenshot requests correctly", async () => {
    // Setup
    const modelName = "test-model";
    const existingText = "test text";
    const url = "https://example.com";
    const screenshot = "data:image/png;base64,abcdefg";
    const userCountry = "TestCountry";
    const userCity = "TestCity";

    // Execute
    await getOpenRouterChatCompletion(
      mockOpenAI,
      modelName,
      existingText,
      url,
      screenshot,
      undefined,
      undefined,
      userCountry,
      userCity
    );

    // Verify
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArg = mockCreate.mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string | unknown[] }>;
    };

    expect(callArg.model).toBe(modelName);
    expect(callArg.messages.length).toBe(2);
    expect(callArg.messages[0].role).toBe("system");
    expect(callArg.messages[1].role).toBe("user");
    expect(Array.isArray(callArg.messages[1].content)).toBe(true);

    const content = callArg.messages[1].content as unknown[];
    expect(content.length).toBe(2);
    expect((content[0] as { type: string }).type).toBe("image_url");
  });

  it("should handle both screenshots correctly", async () => {
    // Setup
    const modelName = "test-model";
    const existingText = "test text";
    const url = "https://example.com";
    const screenshot = "data:image/png;base64,abcdefg";
    const previousScreenshot = "data:image/png;base64,1234567";
    const previousTabUrl = "https://previous.example.com";
    const userCountry = "TestCountry";
    const userCity = "TestCity";

    // Execute
    await getOpenRouterChatCompletion(
      mockOpenAI,
      modelName,
      existingText,
      url,
      screenshot,
      previousScreenshot,
      previousTabUrl,
      userCountry,
      userCity
    );

    // Verify
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArg = mockCreate.mock.calls[0][0] as {
      model: string;
      messages: Array<{ role: string; content: string | unknown[] }>;
    };

    expect(callArg.model).toBe(modelName);
    expect(callArg.messages.length).toBe(2);
    expect(callArg.messages[0].role).toBe("system");
    expect(callArg.messages[1].role).toBe("user");
    expect(Array.isArray(callArg.messages[1].content)).toBe(true);

    const content = callArg.messages[1].content as unknown[];
    expect(content.length).toBe(3);
    expect((content[0] as { type: string }).type).toBe("image_url");
    expect((content[1] as { type: string }).type).toBe("image_url");
  });
});
