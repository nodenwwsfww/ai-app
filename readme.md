<div align="center">
  <h1>Autocomplete</h1>
  <h3>Get autocomplete anywhere on the web.</h3>
  <br />
  <br />
  <figure>
    <img src="https://imgur.com/SS5mlYk.gif" alt="Demo" />
  </figure>
</div>

<br />

> [!NOTE]
>
> In its current version, autocomplete is only available for `<textarea />` elements.
> This project is not perfect and am actively welcoming pull requests.

## How It Works

Autocomplete uses LLMs like GPT-4o (recommended) or Groq (llama3-8b-8192) to complete the next part of a user's sentence. Autocomplete uses the existing sentence and the current URL as context for the results.

## Quickstart

In order to get access to autocomplete anywhere on the web, you'll need to:

- Host your backend on [Railway](https://railway.app) (or any other hosting provider).
- Upload the extension to chrome under [chrome://extensions/](chrome://extensions/). For more information, see [uploading the extension to chrome](#uploading-the-extension-to-chrome).

## Walkthrough

Ensure the repository is cloned and the `.env` file is populated with the environment variables found in `.env.example`. By default the extension uses the GPT4o model, so you can ignore the Groq key if you don't plan on switching models.

**Hosting your backend:**

- Clone this repository
- Head to [Railway](https://railway.app)
- Click "New Project"
- Click "Deploy from a GitHub Repo"
- Find the cloned repository in your GitHub account and deploy
- Go to settings and change Root Directory to `/server`
- While in settings, add the environment variables found in `.env.example` file
- While in settings, generate a domain and paste this domain inside the `/extension/src/index.js` file
- Deploy

**Uploading the extension to chrome:**

- Use the domain generated in Railway inside the `extension/src/index.js` file
- Head to [chrome://extensions/](chrome://extensions/)
- Enable Developer Mode by clicking the toggle switch in the top right
- Click "Load Unpacked" in the top left
- Select the `Extension` folder inside the cloned repository

Congratulations! You have successfully installed the Autocomplete extension and hosted the backend.

## Support