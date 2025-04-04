import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { getOpenRouterChatCompletion } from "./openrouter";

// Helper to create mock completion
const createMockChatCompletion = (content: string): ChatCompletion => ({
  id: "chatcmpl-test123",
  object: "chat.completion",
  created: Date.now(),
  model: "mock-model",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: content,
      },
      finish_reason: "stop",
      logprobs: null
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
});

// Simple manual mock function factory (copied from previous attempt)
const createManualMock = () => {
  const mockFn: any = async (...args: any[]) => {
    mockFn.mock.calls.push(args);
    if (mockFn._rejects) {
      throw mockFn._error;
    }
    return mockFn._resolves !== undefined ? mockFn._resolves : createMockChatCompletion(" default manual mock");
  };
  mockFn.mock = { calls: [] };
  mockFn._resolves = undefined;
  mockFn._rejects = false;
  mockFn._error = undefined;
  mockFn.mockClear = () => { 
    mockFn.mock.calls = []; 
    mockFn._resolves = undefined; 
    mockFn._rejects = false; 
    mockFn._error = undefined; 
  };
  mockFn.mockResolvedValue = (value: any) => { 
    mockFn._resolves = value; 
    mockFn._rejects = false; 
  };
  mockFn.mockRejectedValue = (error: any) => { 
    mockFn._error = error; 
    mockFn._rejects = true; 
  };
  mockFn.toHaveBeenCalledTimes = (count: number) => {
    expect(mockFn.mock.calls.length).toBe(count);
  };
  return mockFn;
};

// Define test data
const testText = "Hello";
const testUrl = "https://example.com";
const testCountry = "Lithuania";
const testCity = "Vilnius";
const testLocation = `${testCity}, ${testCountry}`;
const testScreenshot = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 pixel PNG

const defaultModel = "google/gemini-2.0-flash-exp:free";

describe("getOpenRouterChatCompletion", () => {
  let mockCreateCompletion: ReturnType<typeof createManualMock>;
  let mockOpenAIClient: any; // Mock client object

  beforeEach(() => {
    // No need to reset process.env.OPENROUTER_MODEL here anymore
    mockCreateCompletion = createManualMock();
    mockOpenAIClient = {
      chat: {
        completions: {
          create: mockCreateCompletion,
        },
      },
    };
  });

  // No afterEach needed as we pass the mock directly

  // --- Tests --- 
  it("should correctly format text-only request and call API with default model", async () => {
    const mockContent = " World";
    const mockResponse = createMockChatCompletion(mockContent);
    mockCreateCompletion.mockResolvedValue(mockResponse);

    const result = await getOpenRouterChatCompletion(
      mockOpenAIClient, 
      defaultModel, // Pass default model
      testText, 
      testUrl, 
      undefined, 
      testCountry, 
      testCity
    );

    mockCreateCompletion.toHaveBeenCalledTimes(1); // Use custom assertion
    const callArgs = mockCreateCompletion.mock.calls[0][0];

    expect(callArgs.model).toBe(defaultModel);
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain(`User Location: ${testLocation}`);
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.messages[1].content).toBe(
      `Based *only* on the webpage URL context and the user's location (${testLocation}), predict the text that should directly follow this existing input:\\n\\nExisting Text: "${testText}"`
    );
    expect(result).toEqual(mockResponse);
  });

  it("should correctly format multimodal request and call API with default model", async () => {
    const mockContent = " from image";
    const mockResponse = createMockChatCompletion(mockContent);
    mockCreateCompletion.mockResolvedValue(mockResponse);

    const result = await getOpenRouterChatCompletion(
      mockOpenAIClient, 
      defaultModel, // Pass default model
      testText, 
      testUrl, 
      testScreenshot, 
      testCountry, 
      testCity
    );
    
    mockCreateCompletion.toHaveBeenCalledTimes(1);
    const callArgs = mockCreateCompletion.mock.calls[0][0];

    expect(callArgs.model).toBe(defaultModel);
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain(`User Location: ${testLocation}`);
    expect(callArgs.messages[1].role).toBe("user");
    expect(Array.isArray(callArgs.messages[1].content)).toBe(true); // Check if array
    const userContent = callArgs.messages[1].content as Array<any>; // Type assertion
    expect(userContent).toHaveLength(2);
    expect(userContent[0].type).toBe("image_url");
    expect(userContent[0].image_url.url).toBe(testScreenshot);
    expect(userContent[1].type).toBe("text");
    expect(userContent[1].text).toBe(
       `Based *only* on the immediate visual context near the input field in the screenshot, the webpage URL, and the user's location (${testLocation}), predict the text that should directly follow this existing input:\\n\\nExisting Text: "${testText}"`
    );
    expect(result).toEqual(mockResponse);
  });

  it("should use the passed model name", async () => {
    const customModel = "test/custom-model";
    const mockResponse = createMockChatCompletion(" test");
    mockCreateCompletion.mockResolvedValue(mockResponse);

    await getOpenRouterChatCompletion(mockOpenAIClient, customModel, testText, testUrl);

    mockCreateCompletion.toHaveBeenCalledTimes(1);
    const callArgs = mockCreateCompletion.mock.calls[0][0];
    expect(callArgs.model).toBe(customModel); // Expect the passed model
  });

  it("should handle location correctly when only country is provided", async () => {
    const mockResponse = createMockChatCompletion(" Test");
    mockCreateCompletion.mockResolvedValue(mockResponse);
    await getOpenRouterChatCompletion(mockOpenAIClient, defaultModel, testText, testUrl, undefined, testCountry, undefined);
    const callArgs = mockCreateCompletion.mock.calls[0][0];
    const expectedLocation = testCountry;
    expect(callArgs.messages[0].content).toContain(`User Location: ${expectedLocation}`);
    expect((callArgs.messages[1].content as string)).toContain(`(${expectedLocation})`); // Assertion for text content
  });
  
   it("should handle location correctly when only city is provided", async () => {
    const mockResponse = createMockChatCompletion(" Test");
    mockCreateCompletion.mockResolvedValue(mockResponse);
    await getOpenRouterChatCompletion(mockOpenAIClient, defaultModel, testText, testUrl, undefined, undefined, testCity);
    const callArgs = mockCreateCompletion.mock.calls[0][0];
    const expectedLocation = testCity;
    expect(callArgs.messages[0].content).toContain(`User Location: ${expectedLocation}`);
    expect((callArgs.messages[1].content as string)).toContain(`(${expectedLocation})`); // Assertion for text content
  });

  it("should handle location correctly when neither city nor country is provided", async () => {
    const mockResponse = createMockChatCompletion(" Test");
    mockCreateCompletion.mockResolvedValue(mockResponse);
    await getOpenRouterChatCompletion(mockOpenAIClient, defaultModel, testText, testUrl, undefined, undefined, undefined);
    const callArgs = mockCreateCompletion.mock.calls[0][0];
    const expectedLocation = "Not specified";
    expect(callArgs.messages[0].content).toContain(`User Location: ${expectedLocation}`);
    expect((callArgs.messages[1].content as string)).toContain(`(${expectedLocation})`); // Assertion for text content
  });

  it("should throw error if API call fails", async () => {
    const testError = new Error("API Failure");
    mockCreateCompletion.mockRejectedValue(testError);

    await expect(getOpenRouterChatCompletion(mockOpenAIClient, defaultModel, testText, testUrl))
      .rejects.toThrow("API Failure");
      
    mockCreateCompletion.toHaveBeenCalledTimes(1);
  });
}); 