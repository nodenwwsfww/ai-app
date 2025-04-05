export type AutocompleteRequest = {
  text: string;
  url: string;
  screenshot?: string;
  previousScreenshot?: string;
  previousTabUrl?: string;
  userCountry?: string;
  userCity?: string;
};
