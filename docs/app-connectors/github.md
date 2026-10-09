github offical rest api docs. url: https://docs.github.com/en/rest?apiVersion=2026-03-10


# About the REST API

Get oriented to the REST API documentation.

You can use GitHub's API to build scripts and applications that automate processes, integrate with GitHub, and extend GitHub. For example, you could use the API to triage issues, build an analytics dashboard, or manage releases.

Each REST API endpoint is documented individually, and the endpoints are categorized by the resource that they primarily affect. For example, you can find endpoints relating to issues in [REST API endpoints for issues](/en/rest/issues).

## Getting started with the REST API

**If you are new to REST APIs**, start with the Quickstart or Getting Started guide:

* [Quickstart for GitHub REST API](/en/rest/quickstart)
* [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api)

**If you are familiar with REST APIs** but new to GitHub's REST API, see the authentication documentation:

* [Authenticating to the REST API](/en/rest/authentication/authenticating-to-the-rest-api)

**If you are building scripts or applications** that use the REST API, the following guides can help:

* [Scripting with the REST API and JavaScript](/en/rest/guides/scripting-with-the-rest-api-and-javascript)
* [Scripting with the REST API and Ruby](/en/rest/guides/scripting-with-the-rest-api-and-ruby)
* [Building a GitHub App that responds to webhook events](/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-github-app-that-responds-to-webhook-events)
* [Building a CLI with a GitHub App](/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-cli-with-a-github-app)
* [Automatically redelivering failed deliveries for a repository webhook](/en/webhooks/using-webhooks/automatically-redelivering-failed-deliveries-for-a-repository-webhook)

For a list of libraries to facilitate scripting with the REST API, see [Libraries for the REST API](/en/rest/using-the-rest-api/libraries-for-the-rest-api).

If you are building scripts or applications that use the REST API, you might also be interested in using webhooks to get notified about events or a GitHub App to access resources on behalf of a user or in an organization. For more information, see [About webhooks](/en/webhooks/about-webhooks) and [Deciding when to build a GitHub App](/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app).

## Further reading

* [Comparing GitHub's REST API and GraphQL API](/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api)
* [Best practices for using the REST API](/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
* [Keeping your API credentials secure](/en/rest/authentication/keeping-your-api-credentials-secure)
* [Troubleshooting the REST API](/en/rest/using-the-rest-api/troubleshooting-the-rest-api)

# Getting started with the REST API

Learn how to use the GitHub REST API.

## Introduction

This article describes how to use the GitHub REST API with GitHub CLI, `curl`, or JavaScript. For a quickstart guide, see [Quickstart for GitHub REST API](/en/rest/quickstart).

<div class="ghd-tool curl">

</div>

## About requests to the REST API

This section describes the elements that make up an API request:

* [HTTP method](#http-method)
* [Path](#path)
* [Headers](#headers)
* [Media types](#media-types)
* [Authentication](#authentication)
* [Parameters](#parameters)

Every request to the REST API includes an HTTP method and a path. Depending on the REST API endpoint, you might also need to specify request headers, authentication information, query parameters, or body parameters.

The REST API reference documentation describes the HTTP method, path, and parameters for every endpoint. It also displays example requests and responses for each endpoint. For more information, see the [REST reference documentation](/en/rest).

### HTTP method

The HTTP method of an endpoint defines the type of action it performs on a given resource. Some common HTTP methods are `GET`, `POST`, `DELETE`, and `PATCH`. The REST API reference documentation provides the HTTP method for every endpoint.

For example, the HTTP method for the ["List repository issues" endpoint](/en/rest/issues/issues#list-repository-issues) is `GET`."

Where possible, the GitHub REST API strives to use an appropriate HTTP method for each action.

* `GET`: Used for retrieving resources.
* `POST`: Used for creating resources.
* `PATCH`: Used for updating properties of resources.
* `PUT`: Used for replacing resources or collections of resources.
* `DELETE`: Used for deleting resources.

### Path

Each endpoint has a path. The REST API reference documentation gives the path for every endpoint. For example, the path for the ["List repository issues" endpoint](/en/rest/issues/issues#list-repository-issues) is `/repos/{owner}/{repo}/issues`.

The curly brackets `{}` in a path denote path parameters that you need to specify. Path parameters modify the endpoint path and are required in your request. For example, the path parameters for the ["List repository issues" endpoint](/en/rest/issues/issues#list-repository-issues) are `{owner}` and `{repo}`. To use this path in your API request, replace `{repo}` with the name of the repository where you would like to request a list of issues, and replace `{owner}` with the name of the account that owns the repository.

### Headers

Headers provide extra information about the request and the desired response. Following are some examples of headers that you can use in your requests to the GitHub REST API. For an example of a request that uses headers, see [Making a request](#making-a-request).

#### `Accept`

Most GitHub REST API endpoints specify that you should pass an `Accept` header with a value of `application/vnd.github+json`. The value of the `Accept` header is a media type. For more information about media types, see [Media types](#media-types).

#### `X-GitHub-Api-Version`

You should use this header to specify a version of the REST API to use for your request. For more information, see [API Versions](/en/rest/about-the-rest-api/api-versions).

#### `User-Agent`

All API requests must include a valid `User-Agent` header. The `User-Agent` header identifies the user or application that is making the request.

<div class="ghd-tool cli">

By default, GitHub CLI sends a valid `User-Agent` header. However, GitHub recommends using your GitHub username, or the name of your application, for the `User-Agent` header value. This allows GitHub to contact you if there are problems.

</div>

<div class="ghd-tool curl">

By default, `curl` sends a valid `User-Agent` header. However GitHub recommends using your GitHub username, or the name of your application, for the `User-Agent` header value. This allows GitHub to contact you if there are problems.

</div>

<div class="ghd-tool javascript">

If you use the Octokit.js SDK, the SDK will send a valid `User-Agent` header for you. However, GitHub recommends using your GitHub username, or the name of your application, for the `User-Agent` header value. This allows GitHub to contact you if there are problems.

</div>

The following is an example `User-Agent` for an app named `Awesome-Octocat-App`:

```shell
User-Agent: Awesome-Octocat-App
```

Requests with no `User-Agent` header will be rejected. If you provide an invalid `User-Agent` header, you will receive a `403 Forbidden` response.

<!-- Anchor to maintain links to this heading -->

<a name="media-types"></a>

### Media types

You can specify one or more media types by adding them to the `Accept` header of your request. For more information about the `Accept` header, see [`Accept`](#accept).

Media types specify the format of the data you want to consume from the API. Media types are specific to resources, allowing them to change independently and support formats that other resources don't. The documentation for each GitHub REST API endpoint will describe the media types that it supports. For more information, see the [GitHub REST API documentation](/en/rest).

The most common media types supported by the GitHub REST API are `application/vnd.github+json` and `application/json`.

There are custom media types that you can use with some endpoints. For example, the REST API to manage [commits](/en/rest/commits/commits#get-a-commit) and [pull requests](/en/rest/pulls/pulls) support the media types `diff`, `patch`, and `sha`. The media types `full`, `raw`, `text`, or `html` are used by some other endpoints.

All custom media types for GitHub look like this: `application/vnd.github.PARAM+json`, where `PARAM` is the name of the media type. For example, to specify the `raw` media type, you would use `application/vnd.github.raw+json`.

For an example of a request that uses media types, see [Making a request](#making-a-request).

### Authentication

Many endpoints require authentication or return additional information if you are authenticated. Additionally, you can make more requests per hour when you are authenticated.

<div class="ghd-tool curl">

To authenticate your request, you will need to provide an authentication token with the required scopes or permissions. There are a few different ways to get a token: You can create a personal access token, generate a token with a GitHub App, or use the built-in `GITHUB_TOKEN` in a GitHub Actions workflow. For more information, see [Authenticating to the REST API](/en/rest/authentication/authenticating-to-the-rest-api).

For an example of a request that uses an authentication token, see [Making a request](#making-a-request).

> \[!NOTE]
> If you don't want to create a token, you can use GitHub CLI. GitHub CLI will take care of authentication for you, and help keep your account secure. For more information, see the [GitHub CLI version of this page](/en/rest/using-the-rest-api/getting-started-with-the-rest-api?tool=cli).

> \[!WARNING]
> Treat your access token the same way you would treat your passwords or other sensitive credentials. For more information, see [Keeping your API credentials secure](/en/rest/authentication/keeping-your-api-credentials-secure).

</div>

<div class="ghd-tool cli">

Although some REST API endpoints are accessible without authentication, GitHub CLI requires you to authenticate before you can use the `api` subcommand to make an API request. Use the `auth login` subcommand to authenticate to GitHub. For more information, see [Making a request](#making-a-request).

</div>

<div class="ghd-tool javascript">

To authenticate your request, you will need to provide an authentication token with the required scopes or permissions. There are a few different ways to get a token: You can create a personal access token, generate a token with a GitHub App, or use the built-in `GITHUB_TOKEN` in a GitHub Actions workflow. For more information, see [Authenticating to the REST API](/en/rest/authentication/authenticating-to-the-rest-api).

For an example of a request that uses an authentication token, see [Making a request](#making-a-request).

> \[!WARNING]
> Treat your access token the same way you would treat your passwords or other sensitive credentials. For more information, see [Keeping your API credentials secure](/en/rest/authentication/keeping-your-api-credentials-secure).

</div>

### Parameters

Many API methods require or allow you to send additional information in parameters in your request. There are a few different types of parameters: Path parameters, body parameters, and query parameters.

#### Path parameters

Path parameters modify the endpoint path. These parameters are required in your request. For more information, see [Path](#path).

#### Body parameters

Body parameters allow you to pass additional data to the API. These parameters can be optional or required, depending on the endpoint. For example, a body parameter may allow you to specify an issue title when creating a new issue, or specify certain settings when enabling or disabling a feature. The documentation for each GitHub REST API endpoint will describe the body parameters that it supports. For more information, see the [GitHub REST API documentation](/en/rest).

For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) requires that you specify a title for the new issue in your request. It also allows you to optionally specify other information, such as text to put in the issue body, users to assign to the new issue, or labels to apply to the new issue. For an example of a request that uses body parameters, see [Making a request](#making-a-request).

You must authenticate your request to pass body parameters. For more information, see [Authentication](#authentication).

#### Query parameters

Query parameters allow you to control what data is returned for a request. These parameters are usually optional. The documentation for each GitHub REST API endpoint will describe any query parameters that it supports. For more information, see the [GitHub REST API documentation](/en/rest).

For example, the ["List public events" endpoint](/en/rest/activity/events#list-public-events) returns thirty issues by default. You can use the `per_page` query parameter to return two issues instead of 30. You can use the `page` query parameter to fetch only the first page of results. For an example of a request that uses query parameters, see [Making a request](#making-a-request).

## Making a request

<div class="ghd-tool cli">

This section demonstrates how to make an authenticated request to the GitHub REST API using GitHub CLI.

### 1. Setup

Install GitHub CLI on macOS, Windows, or Linux. For more information, see [Installation](https://github.com/cli/cli#installation) in the GitHub CLI repository.

### 2. Authenticate

1. To authenticate to GitHub, run the following command from your terminal.

   ```shell
   gh auth login
   ```

   You can use the `--scopes` option to specify what scopes you want. If you want to authenticate with a token that you created, you can use the `--with-token` option. For more information, see the [GitHub CLI `auth login` documentation](https://cli.github.com/manual/gh_auth_login).

2. Select where you want to authenticate to:

   * If you access GitHub at GitHub.com, select **GitHub.com**.
   * If you access GitHub at a different domain, select **Other**, then enter your hostname (for example: `octocorp.ghe.com`).

3. Follow the rest of the on-screen prompts.

   GitHub CLI automatically stores your Git credentials for you when you choose HTTPS as your preferred protocol for Git operations and answer "yes" to the prompt asking if you would like to authenticate to Git with your GitHub credentials. This can be useful as it allows you to use Git commands like `git push` and `git pull` without needing to set up a separate credential manager or use SSH.

### 3. Choose an endpoint for your request

1. Choose an endpoint to make a request to. You can explore GitHub's [REST API documentation](/en/rest) to discover endpoints that you can use to interact with GitHub.

2. Identify the HTTP method and path of the endpoint. You will send these with your request. For more information, see [HTTP method](#http-method) and [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the HTTP method `POST` and the path `/repos/{owner}/{repo}/issues`.

3. Identify any required path parameters. Required path parameters appear in curly brackets `{}` in the path of the endpoint. Replace each parameter placeholder with the desired value. For more information, see [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the path `/repos/{owner}/{repo}/issues`, and the path parameters are `{owner}` and `{repo}`. To use this path in your API request, replace `{repo}` with the name of the repository where you would like to create a new issue, and replace `{owner}` with the name of the account that owns the repository.

### 4. Make a request with GitHub CLI

Use the GitHub CLI `api` subcommand to make your API request. For more information, see the [GitHub CLI `api` documentation](https://cli.github.com/manual/gh_api).

In your request, specify the following options and values:

* **--method** followed by the HTTP method and the path of the endpoint. For more information, see [HTTP method](#http-method) and [Path](#path).
* **--header:**
  * **`Accept`:** Pass the media type in an `Accept` header. To pass multiple media types in an `Accept` header, separate the media types with a comma: `Accept: application/vnd.github+json,application/vnd.github.diff`. For more information, see [`Accept`](#accept) and [Media types](#media-types).
  * **`X-GitHub-Api-Version`:** Pass the API version in a `X-GitHub-Api-Version` header. For more information, see [`X-GitHub-Api-Version`](#x-github-api-version).
* **`-f`** or **`-F`** followed by any body parameters or query parameters in `key=value` format. Use the `-F` option to pass a parameter that is a number, Boolean, or null. Use the `-f` option to pass string parameters.

  Some endpoints use query parameters that are arrays. To send an array in the query string, use the query parameter once per array item, and append `[]` after the query parameter name. For example, to provide an array of two repository IDs, use `-f repository_ids[]=REPOSITORY_A_ID -f repository_ids[]=REPOSITORY_B_ID`.

  If you do not need to specify any body parameters or query parameters in your request, omit this option. For more information, see [Body parameters](#body-parameters) and [Query parameters](#query-parameters). For examples, see [Example request using body parameters](#example-request-using-body-parameters) and [Example request using query parameters](#example-request-using-query-parameters).

#### Example request

The following example request uses the ["Get Octocat" endpoint](/en/rest/meta/meta#get-octocat) to return the octocat as ASCII art.

```shell copy
gh api --method GET /octocat \
--header 'Accept: application/vnd.github+json' \
--header "X-GitHub-Api-Version: 2022-11-28"
```

#### Example request using query parameters

The ["List public events" endpoint](/en/rest/activity/events#list-public-events) returns thirty issues by default. The following example uses the `per_page` query parameter to return two issues instead of 30, and the `page` query parameter to fetch only the first page of results.

```shell copy
gh api --method GET /events -F per_page=2 -F page=1
--header 'Accept: application/vnd.github+json' \
```

#### Example request using body parameters

The following example uses the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) to create a new issue in the octocat/Spoon-Knife repository. In the response, find the `html_url` of your issue, and navigate to your issue in the browser.

```shell copy
gh api --method POST /repos/octocat/Spoon-Knife/issues \
--header "Accept: application/vnd.github+json" \
--header "X-GitHub-Api-Version: 2022-11-28" \
-f title='Created with the REST API' \
-f body='This is a test issue created by the REST API' \
```

</div>

<div class="ghd-tool curl">

This section demonstrates how to make an authenticated request to the GitHub REST API using `curl`.

### 1. Setup

You must have `curl` installed on your machine. To check if `curl` is already installed, run `curl --version` on the command line.

* If the output provides information about the version of `curl`, that means `curl` is installed.
* If you get a message similar to `command not found: curl`, that means `curl` is not installed. Download and install `curl`. For more information, see [the curl download page](https://curl.se/download.html).

### 2. Choose an endpoint for your request

1. Choose an endpoint to make a request to. You can explore GitHub's [REST API documentation](/en/rest) to discover endpoints that you can use to interact with GitHub.

2. Identify the HTTP method and path of the endpoint. You will send these with your request. For more information, see [HTTP method](#http-method) and [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the HTTP method `POST` and the path `/repos/{owner}/{repo}/issues`.

3. Identify any required path parameters. Required path parameters appear in curly brackets `{}` in the path of the endpoint. Replace each parameter placeholder with the desired value. For more information, see [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the path `/repos/{owner}/{repo}/issues`, and the path parameters are `{owner}` and `{repo}`. To use this path in your API request, replace `{repo}` with the name of the repository where you would like to create a new issue, and replace `{owner}` with the name of the account that owns the repository.

### 3. Create authentication credentials

Create an access token to authenticate your request. You can save your token and use it for multiple requests. Give the token any scopes or permissions that are required to access the endpoint. You will send this token in an `Authorization` header with your request. For more information, see [Authentication](#authentication).

### 4. Make a `curl` request

Use the `curl` command to make your request. For more information, see [the curl documentation](https://curl.se/docs/manpage.html).

Specify the following options and values in your request:

* **`--request` or `-X`** followed by the HTTP method as the value. For more information, see [HTTP method](#http-method).
* **`--url`** followed by the full path as the value. The full path is a URL that includes the base URL for the GitHub REST API (`https://api.github.com`) and the path of the endpoint, like this: `https://api.github.com/PATH`. Replace `PATH` with the path of the endpoint. For more information, see [Path](#path).

  To use query parameters, add a `?` to the end of the path, then append your query parameter name and value in the form `parameter_name=value`. Separate multiple query parameters with `&`. If you need to send an array in the query string, use the query parameter once per array item, and append `[]` after the query parameter name. For example, to provide an array of two repository IDs, use `?repository_ids[]=REPOSITORY_A_ID&repository_ids[]=REPOSITORY_B_ID`. For more information, see [Query parameters](#query-parameters). For an example, see [Example request using query parameters](#example-request-using-query-parameters-1).
* **`--header` or `-H`:**
  * **`Accept`:** Pass the media type in an `Accept` header. To pass multiple media types in an `Accept` header, separate the media types with a comma, for example: `Accept: application/vnd.github+json,application/vnd.github.diff`. For more information, see [`Accept`](#accept) and [Media types](#media-types).
  * **`X-GitHub-Api-Version`:** Pass the API version in a `X-GitHub-Api-Version` header. For more information, see [`X-GitHub-Api-Version`](#x-github-api-version).
  * **`Authorization`:** Pass your authentication token in an `Authorization` header. Note that in most cases you can use `Authorization: Bearer` or `Authorization: token` to pass a token. However, if you are passing a JSON web token (JWT), you must use `Authorization: Bearer`. For more information, see [Authentication](#authentication). For an example of a request that uses an `Authorization` header, see [Example request using body parameters](#example-request-using-body-parameters-1).
* **`--data` or `-d`** followed by any body parameters within a JSON object. If you do not need to specify any body parameters in your request, omit this option. For more information, see [Body parameters](#body-parameters). For an example, see [Example request using body parameters](#example-request-using-body-parameters-1).

#### Example request

The following example request uses the ["Get Octocat" endpoint](/en/rest/meta/meta#get-octocat) to return the octocat as ASCII art.

```shell copy
curl --request GET \
--url "https://api.github.com/octocat" \
--header "Accept: application/vnd.github+json" \
--header "X-GitHub-Api-Version: 2022-11-28"
```

#### Example request using query parameters

The ["List public events" endpoint](/en/rest/activity/events#list-public-events) returns thirty issues by default. The following example uses the `per_page` query parameter to return two issues instead of 30, and the `page` query parameter to fetch only the first page of results.

```shell copy
curl --request GET \
--url "https://api.github.com/events?per_page=2&page=1" \
--header "Accept: application/vnd.github+json" \
--header "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/events
```

#### Example request using body parameters

The following example uses the [Create an issue](/en/rest/issues/issues#create-an-issue) endpoint to create a new issue in the octocat/Spoon-Knife repository. Replace `YOUR-TOKEN` with the authentication token you created in a previous step.

> \[!NOTE]
> If you are using a fine-grained personal access token, you must replace `octocat/Spoon-Knife` with a repository that you own or that is owned by an organization that you are a member of. Your token must have access to that repository and have read and write permissions for repository issues. For more information, see [Managing your personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

```shell copy
curl \
--request POST \
--url "https://api.github.com/repos/octocat/Spoon-Knife/issues" \
--header "Accept: application/vnd.github+json" \
--header "X-GitHub-Api-Version: 2022-11-28" \
--header "Authorization: Bearer YOUR-TOKEN" \
--data '{
  "title": "Created with the REST API",
  "body": "This is a test issue created by the REST API"
}'
```

</div>

<div class="ghd-tool javascript">

This section demonstrates how to make a request to the GitHub REST API using JavaScript and [Octokit.js](https://github.com/octokit/octokit.js). For a more detailed guide, see [Scripting with the REST API and JavaScript](/en/rest/guides/scripting-with-the-rest-api-and-javascript).

### 1. Setup

You must install `octokit` to use the Octokit.js library shown in the following examples.

* Install `octokit`. For example, `npm install octokit`. For other ways to install or load `octokit`, see [the Octokit.js README](https://github.com/octokit/octokit.js/#readme).

### 2. Choose an endpoint for your request

1. Choose an endpoint to make a request to. You can explore GitHub's [REST API documentation](/en/rest) to discover endpoints that you can use to interact with GitHub.

2. Identify the HTTP method and path of the endpoint. You will send these with your request. For more information, see [HTTP method](#http-method) and [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the HTTP method `POST` and the path `/repos/{owner}/{repo}/issues`.

3. Identify any required path parameters. Required path parameters appear in curly brackets `{}` in the path of the endpoint. Replace each parameter placeholder with the desired value. For more information, see [Path](#path).

   For example, the ["Create an issue" endpoint](/en/rest/issues/issues#create-an-issue) uses the path `/repos/{owner}/{repo}/issues`, and the path parameters are `{owner}` and `{repo}`. To use this path in your API request, replace `{repo}` with the name of the repository where you would like to create a new issue, and replace `{owner}` with the name of the account that owns the repository.

### 3. Create an access token

Create an access token to authenticate your request. You can save your token and use it for multiple requests. Give the token any scopes or permissions that are required to access the endpoint. You will send this token in an `Authorization` header with your request. For more information, see [Authentication](#authentication).

### 4. Make a request with Octokit.js

1. Import `octokit` in your script. For example, `import { Octokit } from "octokit";`. For other ways to import `octokit`, see [the Octokit.js README](https://github.com/octokit/octokit.js/#readme).

2. Create an instance of `Octokit` with your token. Replace `YOUR-TOKEN` with your token.

   ```javascript copy
   const octokit = new Octokit({ 
     auth: 'YOUR-TOKEN'
   });
   ```

3. Use `octokit.request` to execute your request.

   * Send the HTTP method and path as the first argument to the `request` method. For more information, see [HTTP method](#http-method) and [Path](#path).
   * Specify all path, query, and body parameters in an object as the second argument to the `request` method. For more information, see [Parameters](#parameters).

   In the following example request, the HTTP method is `POST`, the path is `/repos/{owner}/{repo}/issues`, the path parameters are `owner: "octocat"` and `repo: "Spoon-Knife"`, and the body parameters are `title: "Created with the REST API"` and `body: "This is a test issue created by the REST API"`.

   > \[!NOTE]
   > If you are using a fine-grained personal access token, you must replace `octocat/Spoon-Knife` with a repository that you own or that is owned by an organization that you are a member of. Your token must have access to that repository and have read and write permissions for repository issues. For more information, see [Managing your personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

   ```javascript copy
   await octokit.request("POST /repos/{owner}/{repo}/issues", {
     owner: "octocat",
     repo: "Spoon-Knife",
     title: "Created with the REST API",
     body: "This is a test issue created by the REST API",
   });
   ```

   The `request` method automatically passes the `Accept: application/vnd.github+json` header. To pass additional headers or a different `Accept` header, add a `headers` property to the object that is passed as a second argument. The value of the `headers` property is an object with the header names as keys and header values as values.

   For example, the following code will send a `content-type` header with a value of `text/plain` and a `X-GitHub-Api-Version` header with a value of `2026-03-10`.

   ```javascript copy
   await octokit.request("GET /octocat", {
     headers: {
       "content-type": "text/plain",
       "X-GitHub-Api-Version": "2026-03-10",
     },
   });
   ```

</div>

## Using the response

After you make a request, the API will return the response status code, response headers, and potentially a response body.

### About the response code and headers

Every request will return an HTTP status code that indicates the success of the response. For more information about response codes, see [the MDN HTTP response status code documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status).

Additionally, the response will include headers that give more details about the response. Headers that start with `X-` or `x-` are custom to GitHub. For example, the `x-ratelimit-remaining` and `x-ratelimit-reset` headers tell you how many requests you can make in a time period.

<div class="ghd-tool cli">

To view the status code and headers, use the `--include` or `--i` option when you send your request.

For example, this request gets a list of issues in the octocat/Spoon-Knife repository:

```shell
gh api \
--header 'Accept: application/vnd.github+json' \
--method GET /repos/octocat/Spoon-Knife/issues \
-F per_page=2 --include
```

And it returns a response code and headers that look something like this:

```shell
HTTP/2.0 200 OK
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: ETag, Link, Location, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset
Cache-Control: private, max-age=60, s-maxage=60
Content-Security-Policy: default-src 'none'
Content-Type: application/json; charset=utf-8
Date: Thu, 04 Aug 2022 19:56:41 GMT
Etag: W/"a63dfbcfdb73621e9d2e89551edcf9856731ced534bd7f1e114a5da1f5f73418"
Link: <https://api.github.com/repositories/1300192/issues?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1300192/issues?per_page=1&page=14817>; rel="last"
Referrer-Policy: origin-when-cross-origin, strict-origin-when-cross-origin
Server: GitHub.com
Strict-Transport-Security: max-age=31536000; includeSubdomains; preload
Vary: Accept, Authorization, Cookie, Accept-Encoding, Accept, X-Requested-With
X-Accepted-Oauth-Scopes: repo
X-Content-Type-Options: nosniff
X-Frame-Options: deny
X-Github-Api-Version-Selected: 2022-08-09
X-Github-Media-Type: github.v3; format=json
X-Github-Request-Id: 1C73:26D4:E2E500:1EF78F4:62EC2479
X-Oauth-Client-Id: 178c6fc778ccc68e1d6a
X-Oauth-Scopes: gist, read:org, repo, workflow
X-Ratelimit-Limit: 15000
X-Ratelimit-Remaining: 14996
X-Ratelimit-Reset: 1659645499
X-Ratelimit-Resource: core
X-Ratelimit-Used: 4
X-Xss-Protection: 0
```

In this example, the response code is `200`, which indicates a successful request.

</div>

<div class="ghd-tool javascript">

When you make a request with Octokit.js, the `request` method returns a promise. If the request was successful, the promise resolves to an object that includes the HTTP status code of the response (`status`) and the response headers (`headers`). If an error occurs, the promise resolves to an object that includes the HTTP status code of the response (`status`) and the response headers (`response.headers`).

You can use a `try/catch` block to catch an error if it occurs. For example, if the request in the following script is successful, the script will log the status code and the value of the `x-ratelimit-remaining` header. If the request was not successful, the script will log the status code, the value of the `x-ratelimit-remaining` header, and the error message.

In the following example, replace `REPO-OWNER` with the name of the account that owns the repository, and `REPO-NAME` with the name of the repository.

```javascript copy
try {
  const result = await octokit.request("GET /repos/{owner}/{repo}/issues", {
    owner: "REPO-OWNER",
    repo: "REPO-NAME",
    per_page: 2,
  });

  console.log(`Success! Status: ${result.status}. Rate limit remaining: ${result.headers["x-ratelimit-remaining"]}`)

} catch (error) {
  console.log(`Error! Status: ${error.status}. Rate limit remaining: ${error.headers["x-ratelimit-remaining"]}. Message: ${error.response.data.message}`)
}
```

</div>

<div class="ghd-tool curl">

To view the status code and headers, use the `--include` or `--i` option when you send your request.

For example, this request gets a list of issues in the octocat/Spoon-Knife repository:

```shell
curl --request GET \
--url "https://api.github.com/repos/octocat/Spoon-Knife/issues?per_page=2" \
--header "Accept: application/vnd.github+json" \
--header "Authorization: Bearer YOUR-TOKEN" \
--include
```

And it returns a response code and headers that look something like this:

```shell
HTTP/2 200
server: GitHub.com
date: Thu, 04 Aug 2022 20:07:51 GMT
content-type: application/json; charset=utf-8
cache-control: public, max-age=60, s-maxage=60
vary: Accept, Accept-Encoding, Accept, X-Requested-With
etag: W/"7fceb7e8c958d3ec4d02524b042578dcc7b282192e6c939070f4a70390962e18"
x-github-media-type: github.v3; format=json
link: <https://api.github.com/repositories/1300192/issues?per_page=2&sort=updated&direction=asc&page=2>; rel="next", <https://api.github.com/repositories/1300192/issues?per_page=2&sort=updated&direction=asc&page=7409>; rel="last"
access-control-expose-headers: ETag, Link, Location, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset
access-control-allow-origin: *
strict-transport-security: max-age=31536000; includeSubdomains; preload
x-frame-options: deny
x-content-type-options: nosniff
x-xss-protection: 0
referrer-policy: origin-when-cross-origin, strict-origin-when-cross-origin
content-security-policy: default-src 'none'
x-ratelimit-limit: 15000
x-ratelimit-remaining: 14996
x-ratelimit-reset: 1659645535
x-ratelimit-resource: core
x-ratelimit-used: 4
accept-ranges: bytes
content-length: 4936
x-github-request-id: 14E0:4BC6:F1B8BA:208E317:62EC2715
```

In this example, the response code is `200`, which indicates a successful request.

</div>

### About the response body

Many endpoints will return a response body. Unless otherwise specified, the response body is in JSON format. Blank fields are included as `null` instead of being omitted. All timestamps return in UTC time, ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`.

Unlike the GraphQL API where you specify what information you want, the REST API typically returns more information than you need. If desired, you can parse the response to pull out specific pieces of information.

<div class="ghd-tool cli">

For example, you can use `>` to redirect the response to a file. In the following example, replace `REPO-OWNER` with the name of the account that owns the repository, and `REPO-NAME` with the name of the repository.

```shell copy
gh api \
--header 'Accept: application/vnd.github+json' \
--method GET /repos/REPO-OWNER/REPO-NAME/issues \
-F per_page=2 > data.json
```

Then you can use jq to get the title and author ID of each issue:

```shell copy
jq '.[] | {title: .title, authorID: .user.id}' data.json
```

The previous two commands return something like:

```json
{
  "title": "Update index.html",
  "authorID": 10701255
}
{
  "title": "Edit index file",
  "authorID": 53709285
}
```

For more information about jq, see [the jq documentation](https://stedolan.github.io/jq/).

</div>

<div class="ghd-tool javascript">

For example, you can get the title and author ID of each issue. In the following example, replace `REPO-OWNER` with the name of the account that owns the repository, and `REPO-NAME` with the name of the repository.

```javascript copy
try {
  const result = await octokit.request("GET /repos/{owner}/{repo}/issues", {
    owner: "REPO-OWNER",
    repo: "REPO-NAME",
    per_page: 2,
  });

  const titleAndAuthor = result.data.map(issue => {title: issue.title, authorID: issue.user.id})

  console.log(titleAndAuthor)

} catch (error) {
  console.log(`Error! Status: ${error.status}. Message: ${error.response.data.message}`)
}
```

</div>

<div class="ghd-tool curl">

For example, you can use `>` to redirect the response to a file. In the following example, replace `REPO-OWNER` with the name of the account that owns the repository, and `REPO-NAME` with the name of the repository.

```shell copy
curl --request GET \
--url "https://api.github.com/repos/REPO-OWNER/REPO-NAME/issues?per_page=2" \
--header "Accept: application/vnd.github+json" \
--header "Authorization: Bearer YOUR-TOKEN" > data.json
```

Then you can use jq to get the title and author ID of each issue:

```shell copy
jq '.[] | {title: .title, authorID: .user.id}' data.json
```

The previous two commands return something like:

```json
{
  "title": "Update index.html",
  "authorID": 10701255
}
{
  "title": "Edit index file",
  "authorID": 53709285
}
```

For more information about jq, see [the jq documentation](https://stedolan.github.io/jq/).

</div>

#### Detailed versus summary representations

A response can include all attributes for a resource or only a subset of attributes, depending on whether you fetch an individual resource or a list of resources.

* When you fetch an *individual resource*, like a specific repository, the response will typically include all attributes for that resource. This is the "detailed" representation of the resource.
* When you fetch a *list of resources*, like a list of multiple repositories, the response will only include a subset of the attributes for each resource. This is the "summary" representation of the resource.

Note that authorization sometimes influences the amount of detail included in a representation.

The reason for this is because some attributes are computationally expensive for the API to provide, so GitHub excludes those attributes from the summary representation. To obtain those attributes, you can fetch the detailed representation.

The documentation provides an example response for each API method. The example response illustrates all attributes that are returned by that method.

#### Hypermedia

All resources may have one or more `*_url` properties linking to other resources. These are meant to provide explicit URLs so that proper API clients don't need to construct URLs on their own. It is highly recommended that API clients use these. Doing so will make future upgrades of the API easier for developers. All URLs are expected to be proper [RFC 6570](https://datatracker.ietf.org/doc/html/rfc6570) URI templates.

You can then expand these templates using something like the [uri\_template](https://github.com/hannesg/uri_template) gem:

```ruby
>> tmpl = URITemplate.new('/notifications{?since,all,participating}')
>> tmpl.expand
=> "/notifications"

>> tmpl.expand all: 1
=> "/notifications?all=1"

>> tmpl.expand all: 1, participating: 1
=> "/notifications?all=1&participating=1"
```

## Rate limiting

The GitHub REST API limits the number of requests you can make within a given time period. For more information about rate limits and how to check your current rate limit status, see [Rate limits for the REST API](/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Next steps

This article demonstrated how to list and create issues in a repository. For more practice, try to comment on an issue, edit the title of an issue, or close an issue. For more information, see the ["Create an issue comment" endpoint](/en/rest/issues/comments#create-an-issue-comment) and the ["Update an issue" endpoint](/en/rest/issues/issues#update-an-issue).

For more information about other endpoints that you can use, see the [REST reference documentation](/en/rest).

# Rate limits for the REST API

Learn about REST API rate limits, how to avoid exceeding them, and what to do if you do exceed them.

## About primary rate limits

GitHub limits the number of REST API requests that you can make within a specific amount of time. This limit helps prevent abuse and denial-of-service attacks, and ensures that the API remains available for all users.

Some endpoints, like the search endpoints, have more restrictive limits. For more information about these endpoints, see [REST API endpoints for rate limits](/en/rest/rate-limit/rate-limit). The GraphQL API also has a separate primary rate limit. See [Rate limits and query limits for the GraphQL API](/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api).

In general, you can calculate your primary rate limit for the REST API based on your method of authentication, as described below.

### Primary rate limit for unauthenticated users

You can make unauthenticated requests if you are only fetching public data. Unauthenticated requests are associated with the originating IP address, not with the user or application that made the request.

The primary rate limit for unauthenticated requests is 60 requests per hour.

### Primary rate limit for authenticated users

You can use a personal access token to make API requests. Additionally, you can authorize a GitHub App or OAuth app, which can then make API requests on your behalf.

All of these requests count towards your personal rate limit of 5,000 requests per hour. Requests made on your behalf by a GitHub App that is owned by a GitHub Enterprise Cloud organization have a higher rate limit of 15,000 requests per hour. Similarly, requests made on your behalf by a OAuth app that is owned or approved by a GitHub Enterprise Cloud organization have a higher rate limit of 15,000 requests per hour if you are a member of the GitHub Enterprise Cloud organization. However, requests made by a higher-limit app reduce the remaining budget available for lower-limit authentication methods. For example, if an app with a 15,000 request limit makes 10,000 requests on your behalf, you will have exhausted the 5,000 request budget for your personal access tokens, even though the app has 5,000 requests remaining.

### Primary rate limit for Git LFS access

API requests are required when you upload or download Git LFS content. These count towards a separate rate limiting bucket with a limit of 300 requests per minute for unauthenticated requests and 3,000 requests per minute for authenticated requests.

Git LFS uses a batch API which processes 100 Git LFS objects per API request by default. That means unauthenticated users can download 30,000 Git LFS objects per minute and authenticated users can upload/download 300,000 Git LFS objects per minute.

### Primary rate limit for GitHub App installations

GitHub Apps authenticating with an installation access token use the installation's minimum rate limit of 5,000 requests per hour. If the installation is on a GitHub Enterprise Cloud organization, the installation has a rate limit of 15,000 requests per hour.

For installations that are not on a GitHub Enterprise Cloud organization, the rate limit for the installation will scale with the number of users and repositories. Installations that have more than 20 repositories receive another 50 requests per hour for each repository. Installations that are on an organization that have more than 20 users receive another 50 requests per hour for each user. The rate limit cannot increase beyond 12,500 requests per hour.

Primary rate limits for GitHub App user access tokens (as opposed to installation access tokens) are dictated by the primary rate limits for the authenticated user. This rate limit is combined with any requests that another GitHub App or OAuth app makes on that user's behalf and any requests that the user makes with a personal access token. For more information, see [Rate limits for the REST API](/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-authenticated-users).

### Primary rate limit for OAuth apps

Primary rate limits for OAuth access tokens generated by a OAuth app are dictated by the primary rate limits for authenticated users. This rate limit is combined with any requests that another GitHub App or OAuth app makes on that user's behalf and any requests that the user makes with a personal access token. See [Primary rate limit for authenticated users](#primary-rate-limit-for-authenticated-users).

OAuth apps can also use their client ID and client secret to fetch public data. For example:

```shell
curl -u YOUR_CLIENT_ID:YOUR_CLIENT_SECRET -I https://api.github.com/meta
```

For these requests, the rate limit is 5,000 requests per hour per OAuth app. If the app is owned by a GitHub Enterprise Cloud organization, the rate limit is 15,000 requests per hour.

> \[!NOTE]
> Never include your app's client secret in client-side code or in code that runs on a user device. The client secret can be used to generate OAuth access tokens for users who have authorized your app, so you should always keep the client secret secure.

### Primary rate limit for `GITHUB_TOKEN` in GitHub Actions

You can use the built-in `GITHUB_TOKEN` to authenticate requests in GitHub Actions workflows. See [Use GITHUB\_TOKEN for authentication in workflows](/en/actions/tutorials/authenticate-with-github_token).

The rate limit for `GITHUB_TOKEN` is 1,000 requests per hour per repository. For requests to resources that belong to a GitHub Enterprise Cloud account, the limit is 15,000 requests per hour per repository.

## About secondary rate limits

In addition to primary rate limits, GitHub enforces secondary rate limits in order to prevent abuse and keep the API available for all users.

You may encounter a secondary rate limit if you:

* *Make too many concurrent requests.* No more than 100 concurrent requests are allowed. This limit is shared across the REST API and GraphQL API.
* *Make too many requests to a single endpoint per minute.* No more than 900 points per minute are allowed for REST API endpoints, and no more than 2,000 points per minute are allowed for the GraphQL API endpoint. For more information about points, see [Calculating points for the secondary rate limit](#calculating-points-for-the-secondary-rate-limit).
* *Make too many requests per minute.* No more than 90 seconds of CPU time per 60 seconds of real time is allowed. No more than 60 seconds of this CPU time may be for the GraphQL API. You can roughly estimate the CPU time by measuring the total response time for your API requests.
* *Make too many requests that consume excessive compute resources in a short period of time.*
* *Create too much content on GitHub in a short amount of time.* In general, no more than 80 content-generating requests per minute and no more than 500 content-generating requests per hour are allowed. Some endpoints have lower content creation limits. Content creation limits include actions taken on the GitHub web interface as well as via the REST API and GraphQL API.
* *Make too many OAuth access token requests in a short period of time.* No more than 2,000 OAuth access token requests per hour are allowed for GitHub Apps and OAuth apps.

These secondary rate limits are subject to change without notice. You may also encounter a secondary rate limit for undisclosed reasons.

### Calculating points for the secondary rate limit

Some secondary rate limits are determined by the point values of requests. For GraphQL requests, these point values are separate from the point value calculations for the primary rate limit.

| Request                                                    | Points |
| ---------------------------------------------------------- | ------ |
| GraphQL requests without mutations                         | 1      |
| GraphQL requests with mutations                            | 5      |
| Most REST API `GET`, `HEAD`, and `OPTIONS` requests        | 1      |
| Most REST API `POST`, `PATCH`, `PUT`, or `DELETE` requests | 5      |

Some REST API endpoints have a different point cost that is not shared publicly.

## Checking the status of your rate limit

You can use the headers that are sent with each response to determine the current status of your primary rate limit.

| Header name             | Description                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-ratelimit-limit`     | The maximum number of requests that you can make per hour                                                                                                                                                                                |
| `x-ratelimit-remaining` | The number of requests remaining in the current rate limit window                                                                                                                                                                        |
| `x-ratelimit-used`      | The number of requests you have made in the current rate limit window                                                                                                                                                                    |
| `x-ratelimit-reset`     | The time at which the current rate limit window resets, in UTC epoch seconds                                                                                                                                                             |
| `x-ratelimit-resource`  | The rate limit resource that the request counted against. For more information about the different resources, see [REST API endpoints for rate limits](/en/rest/rate-limit/rate-limit#get-rate-limit-status-for-the-authenticated-user). |

You can call the `GET /rate_limit` endpoint for a periodic overview of all resource families for the authenticated user. Calling this endpoint does not count against your primary rate limit, but it can count against your secondary rate limit. See [REST API endpoints for rate limits](/en/rest/rate-limit/rate-limit).

> \[!NOTE]
> Because GitHub processes API requests in multiple regions, rate limit values can vary from one response to the next based on the location handling the request. For example, `x-ratelimit-remaining` may be higher on a later response than on an earlier one within the same rate limit window. The `x-ratelimit-*` headers are the authoritative source for your current rate limit status and may differ from values reported by the `GET /rate_limit` endpoint. If the two disagree, rely on the response headers.

Use the `x-ratelimit-*` response headers to pace and back off your requests, but avoid logic that depends on an exact remaining count. Ensure your integration handles `403` and `429` responses as described in [Exceeding the rate limit](#exceeding-the-rate-limit) later in this article.

There is not a way to check the status of your secondary rate limit.

## Exceeding the rate limit

If you exceed your primary rate limit, you will receive a `403` or `429` response, and the `x-ratelimit-remaining` header will be `0`. You should not retry your request until after the time specified by the `x-ratelimit-reset` header.

If you exceed a secondary rate limit, you will receive a `403` or `429` response and an error message that indicates that you exceeded a secondary rate limit. If the `retry-after` response header is present, you should not retry your request until after that many seconds has elapsed. If the `x-ratelimit-remaining` header is `0`, you should not retry your request until after the time, in UTC epoch seconds, specified by the `x-ratelimit-reset` header. Otherwise, wait for at least one minute before retrying. If your request continues to fail due to a secondary rate limit, wait for an exponentially increasing amount of time between retries, and throw an error after a specific number of retries.

Continuing to make requests while you are rate limited may result in the banning of your integration.

## Staying under the rate limit

You should follow best practices to help you stay under the rate limits. See [Best practices for using the REST API](/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

## Getting a higher rate limit

If you want a higher primary rate limit, consider making authenticated requests instead of unauthenticated requests. Authenticated requests have a significantly higher rate limit than unauthenticated requests.

If you are using a personal access token for automation in your organization, consider whether a GitHub App will work instead. The rate limit for GitHub Apps using an installation access token scales with the number of repositories and number of organization users. See [About creating GitHub Apps](/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps).

If you are using GitHub Apps or OAuth apps, consider upgrading to GitHub Enterprise Cloud. GitHub Apps or OAuth apps have higher rate limits for organizations that use GitHub Enterprise Cloud.

# Using pagination in the REST API

Learn how to navigate through paginated responses from the REST API.

## About pagination

When a response from the REST API would include many results, GitHub will paginate the results and return a subset of the results. For example, `GET /repos/octocat/Spoon-Knife/issues` will only return 30 issues from the `octocat/Spoon-Knife` repository even though the repository includes over 1600 open issues. This makes the response easier to handle for servers and for people.

You can use the `link` header from the response to request additional pages of data. If an endpoint supports the `per_page` query parameter, you can control how many results are returned on a page.

This article demonstrates how to request additional pages of results for paginated responses, how to change the number of results returned on each page, and how to write a script to fetch multiple pages of results.

## Using `link` headers

When a response is paginated, the response headers will include a `link` header. If the endpoint does not support pagination, or if all results fit on a single page, the `link` header will be omitted.

The `link` header contains URLs that you can use to fetch additional pages of results. For example, the previous, next, first, and last page of results.

To see the response headers for a particular endpoint, you can use curl, GitHub CLI, or a library you're using to make requests. To see the response headers if you are using a library to make requests, follow the documentation for that library. To see the response headers if you are using curl or GitHub CLI, pass the `--include` flag with your request. For example:

```shell
curl --include --request GET \
--url "https://api.github.com/repos/octocat/Spoon-Knife/issues" \
--header "Accept: application/vnd.github+json"
```

If the response is paginated, the `link` header will look something like this:

```http
link: <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <https://api.github.com/repositories/1300192/issues?page=4>; rel="next", <https://api.github.com/repositories/1300192/issues?page=515>; rel="last", <https://api.github.com/repositories/1300192/issues?page=1>; rel="first"
```

The `link` header provides the URL for the previous, next, first, and last page of results:

* The URL for the previous page is followed by `rel="prev"`.
* The URL for the next page is followed by `rel="next"`.
* The URL for the last page is followed by `rel="last"`.
* The URL for the first page is followed by `rel="first"`.

In some cases, only a subset of these links are available. For example, the link to the previous page won't be included if you are on the first page of results, and the link to the last page won't be included if it can't be calculated.

You can use the URLs from the `link` header to request another page of results. For example, to request the last page of results based on the previous example:

```shell
curl --include --request GET \
--url "https://api.github.com/repositories/1300192/issues?page=515" \
--header "Accept: application/vnd.github+json"
```

The URLs in the `link` header use query parameters to indicate which page of results to return. The query parameters in the `link` URLs may differ between endpoints, however each paginated endpoint will use the `page`, `before`/`after`, or `since` query parameters. (Some endpoints use the `since` parameter for something other than pagination.) In all cases, you can use the URLs in the `link` header to fetch additional pages of results. For more information about query parameters see [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api#query-parameters).

## Changing the number of items per page

If an endpoint supports the `per_page` query parameter, then you can control how many results are returned on a page. For more information about query parameters see [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api#query-parameters).

For most endpoints, the maximum value of `per_page` is `100`. If you specify a value greater than the maximum, GitHub does not return an error. Instead, the value is automatically reduced to the maximum, and the response includes no more than the maximum number of results per page. Because the request still succeeds, you may receive fewer results than you expect without any indication that the `per_page` value was reduced. To confirm the default and maximum `per_page` values for an endpoint, see the reference documentation for that endpoint.

For example, this request uses the `per_page` query parameter to return two items per page:

```shell
curl --include --request GET \
--url "https://api.github.com/repos/octocat/Spoon-Knife/issues?per_page=2" \
--header "Accept: application/vnd.github+json"
```

The `per_page` parameter will automatically be included in the `link` header. For example:

```http
link: <https://api.github.com/repositories/1300192/issues?per_page=2&page=2>; rel="next", <https://api.github.com/repositories/1300192/issues?per_page=2&page=7715>; rel="last"
```

## Scripting with pagination

Instead of manually copying URLs from the `link` header, you can write a script to fetch multiple pages of results.

The following examples use JavaScript and GitHub's Octokit.js library. For more information about Octokit.js, see [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api?tool=javascript) and [the Octokit.js README](https://github.com/octokit/octokit.js/#readme).

### Example using the Octokit.js pagination method

To fetch paginated results with Octokit.js, you can use `octokit.paginate()`. `octokit.paginate()` will fetch the next page of results until it reaches the last page and then return all of the results as a single array. A few endpoints return paginated results as array in an object, as opposed to returning the paginated results as an array. `octokit.paginate()` always returns an array of items even if the raw result was an object.

For example, this script gets all of the issues from the `octocat/Spoon-Knife` repository. Although it requests 100 issues at a time, the function won't return until the last page of data is reached.

```javascript copy
import { Octokit } from "octokit";

const octokit = new Octokit({ });

const data = await octokit.paginate("GET /repos/{owner}/{repo}/issues", {
  owner: "octocat",
  repo: "Spoon-Knife",
  per_page: 100,
  headers: {
    "X-GitHub-Api-Version": "2026-03-10",
  },
});

console.log(data)
```

You can pass an optional map function to `octokit.paginate()` to end pagination before the last page is reached or to reduce memory usage by keeping only a subset of the response. You can also use `octokit.paginate.iterator()` to iterate through a single page at a time instead of requesting every page. For more information, see [the Octokit.js documentation](https://github.com/octokit/octokit.js#pagination).

### Example creating a pagination method

If you are using another language or library that doesn't have a pagination method, you can build your own pagination method. This example still uses the Octokit.js library to make requests, but does not rely on `octokit.paginate()`.

The `getPaginatedData` function makes a request to an endpoint with `octokit.request()`. The data from the response is processed by `parseData`, which handles cases where no data is returned or cases where the data that is returned is an object instead of an array. The processed data is then appended to a list that contains all of the paginated data collected so far. If the response includes a `link` header and if the `link` header includes a link for the next page, then the function uses a RegEx pattern (`nextPattern`) to get the URL for the next page. The function then repeats the previous steps, now using this new URL. Once the `link` header no longer includes a link to the next page, all of the results are returned.

```javascript copy
import { Octokit } from "octokit";

const octokit = new Octokit({ });

async function getPaginatedData(url) {
  const nextPattern = /(?<=<)([\S]*)(?=>; rel="next")/i;
  let pagesRemaining = true;
  let data = [];

  while (pagesRemaining) {
    const response = await octokit.request(`GET ${url}`, {
      per_page: 100,
      headers: {
        "X-GitHub-Api-Version":
          "2026-03-10",
      },
    });

    const parsedData = parseData(response.data)
    data = [...data, ...parsedData];

    const linkHeader = response.headers.link;

    pagesRemaining = linkHeader && linkHeader.includes(`rel=\"next\"`);

    if (pagesRemaining) {
      url = linkHeader.match(nextPattern)[0];
    }
  }

  return data;
}

function parseData(data) {
  // If the data is an array, return that
    if (Array.isArray(data)) {
      return data
    }

  // Some endpoints respond with 204 No Content instead of empty array
  //   when there is no data. In that case, return an empty array.
  if (!data) {
    return []
  }

  // Otherwise, the array of items that we want is in an object
  // Delete keys that don't include the array of items
  delete data.incomplete_results;
  delete data.repository_selection;
  delete data.total_count;
  // Pull out the array of items
  const namespaceKey = Object.keys(data)[0];
  data = data[namespaceKey];

  return data;
}

const data = await getPaginatedData("/repos/octocat/Spoon-Knife/issues");

console.log(data);
```

# Libraries for the REST API

You can use the official Octokit libraries and other third-party libraries to extend and simplify how you use the GitHub API.

## About libraries

You can use libraries to extend and simplify the way your application interacts with GitHub's API. Each library provides pre-built code for a specific programming language. After integrating a library into your project, you can use the pre-built code modules to interact with GitHub's API via a specific programming language.

GitHub maintains official Octokit libraries for some languages. There are also third-party libraries that you can use with GitHub's API, which are not maintained by GitHub.

## Official GitHub libraries

GitHub maintains these official client libraries for the GitHub API. These repositories are open source, and community contributions are welcome.

For more information, see [Scripting with the REST API and JavaScript](/en/rest/guides/scripting-with-the-rest-api-and-javascript) and [Scripting with the REST API and Ruby](/en/rest/guides/scripting-with-the-rest-api-and-ruby).

* JavaScript: [octokit.js](https://github.com/octokit/octokit.js)
* Ruby: [octokit.rb](https://github.com/octokit/octokit.rb)
* .NET: [octokit.net](https://github.com/octokit/octokit.net)
* Terraform: [terraform-provider-github](https://github.com/integrations/terraform-provider-github)

<!-- markdownlint-disable GHD034 -->

## Third-party libraries

The following are examples of third-party libraries that you can use to interact with the GitHub API in various programming languages.

These third-party libraries are not maintained by GitHub. Libraries provided by third parties are governed by separate terms of service, privacy policy, and support documentation.

### Clojure

* Tentacles: [clj-commons/tentacles](https://github.com/clj-commons/tentacles)

### Dart

* github.dart: [SpinlockLabs/github.dart](https://github.com/SpinlockLabs/github.dart)

### Emacs Lisp

* gh.el: [sigma/gh.el](https://github.com/sigma/gh.el)

### Go

* go-github: [google/go-github](https://github.com/google/go-github)

### Haskell

* haskell-github: [haskell-github/github](https://github.com/fpco/github)

### Java

* GitHub API for Java, an object oriented representation of the GitHub API: [hub4j/github-api](https://hub4j.github.io/github-api/)
* JCabi GitHub API, based on Java7 JSON API (JSR-353), simplifies tests with a runtime GitHub stub, and covers the entire API: [github.jcabi.com (Personal Website)](https://github.jcabi.com)

### JavaScript

* NodeJS GitHub library: [pksunkara/octonode](https://github.com/pksunkara/octonode)
* Github.js wrapper around the GitHub API: [github-tools/github](https://github.com/github-tools/github)
* Promise-Based CoffeeScript library for the Browser or NodeJS: [philschatz/github-client](https://github.com/philschatz/github-client)

### Julia

* GitHub.jl: [JuliaWeb/GitHub.jl](https://github.com/JuliaWeb/GitHub.jl)

### OCaml

* ocaml-github: [mirage/ocaml-github](https://github.com/mirage/ocaml-github)

### Perl

* Pithub: [plu/Pithub](https://github.com/plu/Pithub)
* Net::GitHub: [fayland/perl-net-github](https://github.com/fayland/perl-net-github)

### PHP

* PHP GitHub API: [KnpLabs/php-github-api](https://github.com/KnpLabs/php-github-api)
* GitHub Joomla! Package: [joomla-framework/github-api](https://github.com/joomla-framework/github-api)
* GitHub bridge for Laravel: [GrahamCampbell/Laravel-GitHub](https://github.com/GrahamCampbell/Laravel-GitHub)

### PowerShell

* PowerShellForGitHub: [microsoft/PowerShellForGitHub](https://github.com/microsoft/PowerShellForGitHub)

### Python

* gidgethub: [gidgethub/gidgethub](https://github.com/gidgethub/gidgethub)
* ghapi: [fastai/ghapi](https://github.com/fastai/ghapi)
* PyGithub: [PyGithub/PyGithub](https://github.com/PyGithub/PyGithub)
* libsaas: [duckboard/libsaas](https://github.com/ducksboard/libsaas)
* github3.py: [sigmavirus24/github3.py](https://github.com/sigmavirus24/github3.py)
* agithub: [mozilla/agithub](https://github.com/mozilla/agithub)
* github-flask: [github-flask (Official Website)](http://github-flask.readthedocs.org)
* githubkit: [yanyongyu/githubkit](https://github.com/yanyongyu/githubkit)
* octokit.py: [khornberg/octokit.py](https://github.com/khornberg/octokit.py)

### Ruby

* GitHub API Gem: [piotrmurach/github](https://github.com/piotrmurach/github)

### Rust

* Octocrab: [XAMPPRocky/octocrab](https://github.com/XAMPPRocky/octocrab)

### Scala

* Github4s: [47deg/github4s](https://github.com/47deg/github4s)

### Shell

* ok.sh: [whiteinge/ok.sh](https://github.com/whiteinge/ok.sh)

# Best practices for using the REST API

Follow these best practices when using GitHub's API.

## Avoid polling

You should subscribe to webhook events instead of polling the API for data. This will help your integration stay within the API rate limit. For more information, see [Webhooks documentation](/en/webhooks).

If you cannot use webhooks and you must poll the API, poll as efficiently as possible to avoid exceeding the rate limit:

* Poll only as often as you need to, on a fixed schedule. If a response includes an `x-poll-interval` header, wait at least that many seconds before you poll the same endpoint again.
* Make authenticated conditional requests, so that unchanged data does not count against your primary rate limit. For more information, see [Use conditional requests](#use-conditional-requests).
* Request only the data that you need, and keep responses stable, so that more of your polls return `304 Not Modified`. For more information, see [Make requests that can be cached](#make-requests-that-can-be-cached).

## Make authenticated requests

Authenticated requests have a higher primary rate limit than unauthenticated requests. To avoid exceeding the rate limit, you should make authenticated requests. For more information, see [Rate limits for the REST API](/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Avoid concurrent requests

To avoid exceeding secondary rate limits, you should make requests serially instead of concurrently. To achieve this, you can implement a queue system for requests.

## Pause between mutative requests

If you are making a large number of `POST`, `PATCH`, `PUT`, or `DELETE` requests, wait at least one second between each request. This will help you avoid secondary rate limits.

## Handle rate limit errors appropriately

If you receive a rate limit error, you should stop making requests temporarily according to these guidelines:

* If the `retry-after` response header is present, you should not retry your request until after that many seconds has elapsed.
* If the `x-ratelimit-remaining` header is `0`, you should not make another request until after the time specified by the `x-ratelimit-reset` header. The `x-ratelimit-reset` header is in UTC epoch seconds.
* Otherwise, wait for at least one minute before retrying. If your request continues to fail due to a secondary rate limit, wait for an exponentially increasing amount of time between retries, and throw an error after a specific number of retries.

Continuing to make requests while you are rate limited may result in the banning of your integration.

## Follow redirects

The GitHub REST API uses HTTP redirection where appropriate. You should assume that any
request may result in a redirection. Receiving an HTTP redirection is not an error, and you should follow the redirect.

A `301` status code indicates permanent redirection. You should repeat your request to the URL specified by the `location` header. Additionally, you should update your code to use this URL for future requests.

A `302` or `307` status code indicates temporary redirection. You should repeat your request to the URL specified by the `location` header. However, you should not update your code to use this URL for future requests.

Other redirection status codes may be used in accordance with HTTP specifications.

## Do not manually parse URLs

Many API endpoints return URL values for fields in the response body. You should not try to parse these URLs or to predict the structure of future URLs. This can cause your integration to break if GitHub changes the structure of the URL in the future. Instead, you should look for a field that contains the information that you need. For example, the endpoint to create an issue returns an `html_url` field with a value like `https://github.com/octocat/Hello-World/issues/1347` and a `number` field with a value like `1347`. If you need to know the number of the issue, use the `number` field instead of parsing the `html_url` field.

Similarly, you should not try to manually construct pagination queries. Instead, you should use the link headers to determine what pages of results you can request. For more information, see [Using pagination in the REST API](/en/rest/using-the-rest-api/using-pagination-in-the-rest-api).

## Use conditional requests

Most endpoints return an `etag` header, and many endpoints return a `last-modified` header. You can use the values of these headers to make conditional `GET` requests. If the response has not changed, you will receive a `304 Not Modified` response. Making a conditional request does not count against your primary rate limit if a `304` response is returned and the request was made while correctly authorized with an `Authorization` header. This makes conditional requests especially useful when you poll an endpoint, because each `304 Not Modified` response is fast and does not use your rate limit.

In the following examples, replace `YOUR-TOKEN` with your access token.

To make a conditional request with an `etag`:

1. Make a request and save the value of the `etag` header from the response.

   ```shell
   curl --include --header "Authorization: Bearer YOUR-TOKEN" https://api.github.com/repos/octocat/Spoon-Knife/pulls
   ```

   The response includes an `etag` header:

   ```text
   HTTP/2 200
   etag: "644b5b0155e6404a9cc4bd9d8b1ae730"
   ```

2. On your next request to the same URL, send the saved value in the `if-none-match` header.

   ```shell
   curl --include --header "Authorization: Bearer YOUR-TOKEN" --header 'if-none-match: "644b5b0155e6404a9cc4bd9d8b1ae730"' https://api.github.com/repos/octocat/Spoon-Knife/pulls
   ```

   If the data has not changed, you will receive a `304 Not Modified` response, which does not count against your primary rate limit:

   ```text
   HTTP/2 304
   ```

You can also use the `last-modified` header. For example, if a previous request returned a `last-modified` header value of `Wed, 25 Oct 2023 19:17:59 GMT`, you can use the `if-modified-since` header in a future request:

```shell
curl --include --header "Authorization: Bearer YOUR-TOKEN" --header 'if-modified-since: Wed, 25 Oct 2023 19:17:59 GMT' https://api.github.com/repos/octocat/Spoon-Knife
```

Conditional requests for unsafe methods, such as `POST`, `PUT`, `PATCH`, and `DELETE` are not supported unless otherwise noted in the documentation for a specific endpoint.

## Make requests that can be cached

A conditional request only saves you time and rate limit if the endpoint returns `304 Not Modified`. The endpoint returns `304` when the representation that you requested has not changed since you saved its `etag` or `last-modified` value; unrelated response headers, such as the date, can still differ. To make `304` responses more likely when you poll, keep your requests stable and specific.

Request only the data that you need. A smaller, more specific response changes less often, so it returns `304 Not Modified` more often. For example, to check the pull requests for one branch, filter the list by that branch instead of listing every pull request and searching the results yourself. Replace `HEAD-OWNER` with the account that owns the head branch; for a pull request from a fork, this is the account that owns the fork. Replace `BRANCH-NAME` with the name of the branch, and URL-encode it if it contains special characters such as `#` or `&`:

```shell
curl --include --header "Authorization: Bearer YOUR-TOKEN" "https://api.github.com/repos/octocat/Spoon-Knife/pulls?head=HEAD-OWNER:BRANCH-NAME"
```

If you page through a list, use a stable sort order. Some parameters, such as `sort=updated`, reorder the list whenever an item changes. When an item moves to a new position, the items between its old and new positions shift onto different pages, so pages that you already fetched can return new data instead of `304 Not Modified`. A stable order, such as the default, stops updates to existing items from reordering the list, although adding or removing items can still shift entries onto other pages.

Use the same parameters every time you poll the same data. A different page size, page number, or filter produces a different response with a different `etag`.

## Do not ignore errors

You should not ignore repeated `4xx` and `5xx` error codes. Instead, you should ensure that you are correctly interacting with the API. For example, if an endpoint requests a string and you are passing it a numeric value, you will receive a validation error. Similarly, attempting to access an unauthorized or nonexistent endpoint will result in a `4xx` error.

If you are polling and a resource repeatedly returns a `404 Not Found` response, do not keep requesting it on every poll. First, make sure that the `404` is not caused by authentication or authorization. GitHub returns a `404 Not Found` response instead of a `403 Forbidden` response for some private resources when your credentials do not grant access, so a `404` does not always mean that the resource is absent. For more information, see [Troubleshooting the REST API](/en/rest/using-the-rest-api/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource). Once you have confirmed that your credentials are correct, wait much longer before you check again, or check again only when you have a reason to believe that the resource now exists. Repeatedly requesting a missing resource wastes your rate limit and can trigger a secondary rate limit.

Intentionally ignoring repeated validation errors may result in the suspension of your app for abuse.

## Further reading

* [Best practices for using webhooks](/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
* [Best practices for creating a GitHub App](/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)

# Using CORS and JSONP to make cross-origin requests

You can make API requests across domains using cross-origin resource sharing (CORS) and JSONP callbacks.

## About cross-origin requests

A cross-origin request is a request made to a different domain than the one originating the request. For security reasons, most web browsers block cross-origin requests. However, you can use cross-origin resource sharing (CORS) and JSONP callbacks to make cross-origin requests.

## Cross-origin resource sharing (CORS)

The REST API supports cross-origin resource sharing (CORS) for AJAX requests from any origin. For more information, see the [CORS W3C Recommendation](http://www.w3.org/TR/cors/) and the [HTML 5 Security Guide](https://code.google.com/archive/p/html5security/wikis/CrossOriginRequestSecurity.wiki)

Here's a sample request sent from a browser hitting
`http://example.com`:

```shell
$ curl -I https://api.github.com -H "Origin: http://example.com"
HTTP/2 302
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: ETag, Link, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval
```

This is what the CORS preflight request looks like:

```shell
$ curl -I https://api.github.com -H "Origin: http://example.com" -X OPTIONS
HTTP/2 204
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-Requested-With
Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE
Access-Control-Expose-Headers: ETag, Link, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval
Access-Control-Max-Age: 86400
```

## JSON-P callbacks

You can send a `?callback` parameter to any GET call to have the results
wrapped in a JSON function. This is typically used when browsers want to embed GitHub content in web pages and avoid cross-domain problems. The response includes the same data output as the regular API, plus the relevant HTTP Header information.

```shell
$ curl https://api.github.com?callback=foo

> /**/foo({
>   "meta": {
>     "status": 200,
>     "x-ratelimit-limit": "5000",
>     "x-ratelimit-remaining": "4966",
>     "x-ratelimit-reset": "1372700873",
>     "link": [ // pagination headers and other links
>       ["https://api.github.com?page=2", {"rel": "next"}]
>     ]
>   },
>   "data": {
>     // the data
>   }
> })
```

You can write a JavaScript handler to process the callback. Here's a minimal example you can try:

```html
<html>
<head>
<script type="text/javascript">
function foo(response) {
  var meta = response.meta;
  var data = response.data;
  console.log(meta);
  console.log(data);
}

var script = document.createElement('script');
script.src = 'https://api.github.com?callback=foo';

document.getElementsByTagName('head')[0].appendChild(script);
</script>
</head>

<body>
  <p>Open up your browser's console.</p>
</body>
</html>
```

All of the headers have the same string value as the HTTP headers, except `link`. The `link` header is pre-parsed for you and comes through as an array of `[url, options]` tuples.

For example, a link that looks like this:

```shell
link: <url1>; rel="next", <url2>; rel="foo"; bar="baz"
```

will look like this in the Callback output:

```json
{
  "link": [
    [
      "url1",
      {
        "rel": "next"
      }
    ],
    [
      "url2",
      {
        "rel": "foo",
        "bar": "baz"
      }
    ]
  ]
}
```

# Authenticating to the REST API

You can authenticate to the REST API to access more endpoints and have a higher rate limit.

## About authentication

Many REST API endpoints require authentication or return additional information if you are authenticated. Additionally, you can make more requests per hour when you are authenticated.

To authenticate your request, you will need to provide an authentication token with the required scopes or permissions. There are a few different ways to get a token: You can create a personal access token, generate a token with a GitHub App, or use the built-in `GITHUB_TOKEN` in a GitHub Actions workflow.

After creating a token, you can authenticate your request by sending the token in the `Authorization` header of your request. For example, in the following request, replace `YOUR-TOKEN` with a reference to your token:

```shell
curl --request GET \
--url "https://api.github.com/octocat" \
--header "Authorization: Bearer YOUR-TOKEN" \
--header "X-GitHub-Api-Version: 2026-03-10"
```

> \[!NOTE]
> In most cases, you can use `Authorization: Bearer` or `Authorization: token` to pass a token. However, if you are passing a JSON web token (JWT), you must use `Authorization: Bearer`.

### Failed login limit

If you try to use a REST API endpoint without a token or with a token that has insufficient permissions, you will receive a `404 Not Found` or `403 Forbidden` response. Authenticating with invalid credentials will initially return a `401 Unauthorized` response.

After detecting several requests with invalid credentials within a short period, the API will temporarily reject all authentication attempts for that user (including ones with valid credentials) with a `403 Forbidden` response. For more information, see [Rate limits for the REST API](/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Authenticating with a personal access token

If you want to use the GitHub REST API for personal use, you can create a personal access token. If possible, GitHub recommends that you use a fine-grained personal access token instead of a personal access token (classic). For more information about creating a personal access token, see [Managing your personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

If you are using a fine-grained personal access token, your fine-grained personal access token requires specific permissions in order to access each REST API endpoint. The REST API reference document for each endpoint states whether the endpoint works with fine-grained personal access tokens and states what permissions are required in order for the token to use the endpoint. Some endpoints may require multiple permissions, and some endpoints may require one of multiple permissions. For an overview of which REST API endpoints a fine-grained personal access token can access with each permission, see [Permissions required for fine-grained personal access tokens](/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).

If you are using a personal access token (classic), it requires specific scopes in order to access each REST API endpoint. For general guidance about what scopes to choose, see [Scopes for OAuth apps](/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes).

Personal access tokens act as your identity (limited by the scopes or permissions you selected) when you make requests to the REST API. As such, it is important to keep your personal access tokens secure. For more information about keeping your personal access tokens secure, see [Keeping your API credentials secure](/en/rest/authentication/keeping-your-api-credentials-secure?apiVersion=2022-11-28).

### Personal access tokens and SAML SSO

If you use a personal access token (classic) to access an organization that enforces SAML single sign-on (SSO) for authentication, you will need to authorize your token after creation. Fine-grained personal access tokens are authorized during token creation, before access to the organization is granted. For more information, see [Authorizing a personal access token for use with single sign-on](/en/authentication/authenticating-with-single-sign-on/authorizing-a-personal-access-token-for-use-with-single-sign-on).

If you do not authorize your personal access token (classic) for SAML SSO before you try to use it to access a single organization that enforces SAML SSO, you may receive a `404 Not Found` or a `403 Forbidden` error. If you receive a `403 Forbidden` error, the `X-GitHub-SSO` header will include a URL that you can follow to authorize your token. The URL expires after one hour.

If you do not authorize your personal access token (classic) for SAML SSO before you try to use it to access multiple organizations, the API will not return results from the organizations that require SAML SSO and the `X-GitHub-SSO` header will indicate the ID of the organizations that require SAML SSO authorization of your personal access token (classic). For example: `X-GitHub-SSO: partial-results; organizations=21955855,20582480`.

## Authenticating with a token generated by an app

If you want to use the API for an organization or on behalf of another user, GitHub recommends that you use a GitHub App. For more information, see [About authentication with a GitHub App](/en/apps/creating-github-apps/authenticating-with-a-github-app/about-authentication-with-a-github-app).

The REST API reference documentation for each endpoint states whether the endpoint works with GitHub Apps and states what permissions are required in order for the app to use the endpoint. Some endpoints may require multiple permissions, and some endpoints may require one of multiple permissions. For an overview of which REST API endpoints a GitHub App can access with each permission, see [Permissions required for GitHub Apps](/en/rest/authentication/permissions-required-for-github-apps).

You can also create an OAuth token with an OAuth app to access the REST API. However, GitHub recommends that you use a GitHub App instead. GitHub Apps allow more control over the access and permission that the app has.

Access tokens created by apps are automatically authorized for SAML SSO.

### Using basic authentication

Some REST API endpoints for GitHub Apps and OAuth apps require you to use basic authentication to access the endpoint. You will use the app's client ID as the username and the app's client secret as the password.

For example:

```shell
curl --request POST \
--url "https://api.github.com/applications/YOUR_CLIENT_ID/token" \
--user "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
--header "Accept: application/vnd.github+json" \
--header "X-GitHub-Api-Version: 2026-03-10" \
--data '{
  "access_token": "ACCESS_TOKEN_TO_CHECK"
}'
```

The client ID and client secret are associated with the app, not with the owner of the app or a user who authorized the app. They are used to perform operations on behalf of the app, such as creating access tokens.

If you are the owner of a GitHub App or OAuth app, or if you are an app manager for a GitHub App, you can find the client ID and generate a client secret on the settings page for your app. To navigate to your app's settings page:

1. In the upper-right corner of any page on GitHub, click your profile picture.
2. Navigate to your account settings.
   * For an app owned by a personal account, click **Settings**.
   * For an app owned by an organization:
     1. Click **Your organizations**.
     2. To the right of the organization, click **Settings**.
3. In the left sidebar, click **<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" class="octicon octicon-code" aria-label="code" role="img"><path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path></svg> Developer settings**.
4. In the left sidebar, click **GitHub Apps** or **OAuth apps**.
5. For GitHub Apps, to the right of the GitHub App you want to access, click **Edit**. For OAuth apps, click the app that you want to access.
6. Next to **Client ID**, you will see the client ID for your app.
7. Next to **Client secrets**, click **Generate a new client secret** to generate a client secret for your app.

## Authenticating in a GitHub Actions workflow

If you want to use the API in a GitHub Actions workflow, GitHub recommends that you authenticate with the built-in `GITHUB_TOKEN` instead of creating a token. You can grant permissions to the `GITHUB_TOKEN` with the `permissions` key. For more information, see [Use GITHUB\_TOKEN for authentication in workflows](/en/actions/tutorials/authenticate-with-github_token#modifying-the-permissions-for-the-github_token).

If this is not possible, you can store your token as a secret and use the name of your secret in your GitHub Actions workflow. For more information about secrets, see [Using secrets in GitHub Actions](/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

### Authenticating in a GitHub Actions workflow using GitHub CLI

To make an authenticated request to the API in a GitHub Actions workflow using GitHub CLI, you can store the value of `GITHUB_TOKEN` as an environment variable, and use the `run` keyword to execute the GitHub CLI `api` subcommand. For more information about the `run` keyword, see [Workflow syntax for GitHub Actions](/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun).

In the following example workflow, replace `PATH` with the path of the endpoint. For more information about the path, see [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api?tool=cli#path).

```yaml
jobs:
  use_api:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh api /PATH
```

### Authenticating in a GitHub Actions workflow using `curl`

To make an authenticated request to the API in a GitHub Actions workflow using `curl`, you can store the value of `GITHUB_TOKEN` as an environment variable, and use the `run` keyword to execute a `curl` request to the API. For more information about the `run` keyword, see [Workflow syntax for GitHub Actions](/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun).

In the following example workflow, replace `PATH` with the path of the endpoint. For more information about the path, see [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api?tool=cli#path).

```yaml copy
jobs:
  use_api:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl --request GET \
          --url "https://api.github.com/PATH" \
          --header "Authorization: Bearer $GH_TOKEN"
```

### Authenticating in a GitHub Actions workflow using JavaScript

For an example of how to authenticate in a GitHub Actions workflow using JavaScript, see [Scripting with the REST API and JavaScript](/en/rest/guides/scripting-with-the-rest-api-and-javascript#authenticating-in-github-actions).

## Authenticating with username and password

Authentication with username and password is not supported. If you try to authenticate with user name and password, you will receive a 4xx error.

## Further reading

* [Keeping your API credentials secure](/en/rest/authentication/keeping-your-api-credentials-secure)
* [Getting started with the REST API](/en/rest/using-the-rest-api/getting-started-with-the-rest-api#authentication)

Endpoints available for GitHub App installation access tokens
Your GitHub App can make requests to the following REST endpoints with an installation access token.

Who can use this feature?
You can use an installation access token to access these endpoints using your GitHub App. For more information, see Authenticating as a GitHub App installation.

In this article
actions
activity
agents
apps
billing
branches
campaigns
checks
code-quality
code-scanning
code-security
codes-of-conduct
codespaces
collaborators
commits
copilot
copilot-spaces
dependabot
dependency-graph
deploy-keys
deployments
emojis
git
gitignore
interactions
issues
licenses
markdown
meta
metrics
orgs
packages
pages
private-registries
projects
pulls
rate-limit
reactions
releases
repos
search
secret-scanning
security-advisories
teams
users
actions
GET /enterprises/{enterprise}/actions/cache/retention-limit
PUT /enterprises/{enterprise}/actions/cache/retention-limit
GET /enterprises/{enterprise}/actions/cache/storage-limit
PUT /enterprises/{enterprise}/actions/cache/storage-limit
GET /enterprises/{enterprise}/actions/oidc/customization/properties/repo
POST /enterprises/{enterprise}/actions/oidc/customization/properties/repo
DELETE /enterprises/{enterprise}/actions/oidc/customization/properties/repo/{custom_property_name}
GET /organizations/{org}/actions/cache/retention-limit
PUT /organizations/{org}/actions/cache/retention-limit
GET /organizations/{org}/actions/cache/storage-limit
PUT /organizations/{org}/actions/cache/storage-limit
GET /orgs/{org}/actions/cache/usage
GET /orgs/{org}/actions/cache/usage-by-repository
GET /orgs/{org}/actions/hosted-runners
POST /orgs/{org}/actions/hosted-runners
GET /orgs/{org}/actions/hosted-runners/images/custom
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}
GET /orgs/{org}/actions/hosted-runners/images/github-owned
GET /orgs/{org}/actions/hosted-runners/images/partner
GET /orgs/{org}/actions/hosted-runners/limits
GET /orgs/{org}/actions/hosted-runners/machine-sizes
GET /orgs/{org}/actions/hosted-runners/platforms
GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
GET /orgs/{org}/actions/oidc/customization/properties/repo
POST /orgs/{org}/actions/oidc/customization/properties/repo
DELETE /orgs/{org}/actions/oidc/customization/properties/repo/{custom_property_name}
GET /orgs/{org}/actions/oidc/customization/sub
PUT /orgs/{org}/actions/oidc/customization/sub
GET /orgs/{org}/actions/permissions
PUT /orgs/{org}/actions/permissions
GET /orgs/{org}/actions/permissions/artifact-and-log-retention
PUT /orgs/{org}/actions/permissions/artifact-and-log-retention
GET /orgs/{org}/actions/permissions/fork-pr-contributor-approval
PUT /orgs/{org}/actions/permissions/fork-pr-contributor-approval
GET /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos
PUT /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos
GET /orgs/{org}/actions/permissions/repositories
PUT /orgs/{org}/actions/permissions/repositories
PUT /orgs/{org}/actions/permissions/repositories/{repository_id}
DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}
GET /orgs/{org}/actions/permissions/selected-actions
PUT /orgs/{org}/actions/permissions/selected-actions
GET /orgs/{org}/actions/permissions/self-hosted-runners
PUT /orgs/{org}/actions/permissions/self-hosted-runners
GET /orgs/{org}/actions/permissions/self-hosted-runners/repositories
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}
DELETE /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}
GET /orgs/{org}/actions/permissions/workflow
PUT /orgs/{org}/actions/permissions/workflow
GET /orgs/{org}/actions/policies
POST /orgs/{org}/actions/policies
GET /orgs/{org}/actions/policies/{policy_id}
PUT /orgs/{org}/actions/policies/{policy_id}
DELETE /orgs/{org}/actions/policies/{policy_id}
GET /orgs/{org}/actions/runner-groups
POST /orgs/{org}/actions/runner-groups
GET /orgs/{org}/actions/runner-groups/{runner_group_id}
PATCH /orgs/{org}/actions/runner-groups/{runner_group_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
GET /orgs/{org}/actions/runners
GET /orgs/{org}/actions/runners/deprecations/{version}
GET /orgs/{org}/actions/runners/downloads
POST /orgs/{org}/actions/runners/generate-jitconfig
POST /orgs/{org}/actions/runners/registration-token
POST /orgs/{org}/actions/runners/remove-token
GET /orgs/{org}/actions/runners/{runner_id}
DELETE /orgs/{org}/actions/runners/{runner_id}
GET /orgs/{org}/actions/runners/{runner_id}/labels
POST /orgs/{org}/actions/runners/{runner_id}/labels
PUT /orgs/{org}/actions/runners/{runner_id}/labels
DELETE /orgs/{org}/actions/runners/{runner_id}/labels
DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}
GET /orgs/{org}/actions/secrets
GET /orgs/{org}/actions/secrets/public-key
GET /orgs/{org}/actions/secrets/{secret_name}
PUT /orgs/{org}/actions/secrets/{secret_name}
DELETE /orgs/{org}/actions/secrets/{secret_name}
GET /orgs/{org}/actions/secrets/{secret_name}/repositories
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/actions/variables
POST /orgs/{org}/actions/variables
GET /orgs/{org}/actions/variables/{name}
PATCH /orgs/{org}/actions/variables/{name}
DELETE /orgs/{org}/actions/variables/{name}
GET /orgs/{org}/actions/variables/{name}/repositories
PUT /orgs/{org}/actions/variables/{name}/repositories
PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/actions/artifacts
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}
GET /repos/{owner}/{repo}/actions/cache/retention-limit
PUT /repos/{owner}/{repo}/actions/cache/retention-limit
GET /repos/{owner}/{repo}/actions/cache/storage-limit
PUT /repos/{owner}/{repo}/actions/cache/storage-limit
GET /repos/{owner}/{repo}/actions/cache/usage
GET /repos/{owner}/{repo}/actions/caches
DELETE /repos/{owner}/{repo}/actions/caches
DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}
GET /repos/{owner}/{repo}/actions/concurrency_groups
GET /repos/{owner}/{repo}/actions/concurrency_groups/{concurrency_group_name}
GET /repos/{owner}/{repo}/actions/jobs/{job_id}
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/steps/{step_number}/logs
GET /repos/{owner}/{repo}/actions/oidc/customization/sub
PUT /repos/{owner}/{repo}/actions/oidc/customization/sub
GET /repos/{owner}/{repo}/actions/organization-secrets
GET /repos/{owner}/{repo}/actions/organization-variables
GET /repos/{owner}/{repo}/actions/permissions
PUT /repos/{owner}/{repo}/actions/permissions
GET /repos/{owner}/{repo}/actions/permissions/access
PUT /repos/{owner}/{repo}/actions/permissions/access
GET /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention
PUT /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos
GET /repos/{owner}/{repo}/actions/permissions/selected-actions
PUT /repos/{owner}/{repo}/actions/permissions/selected-actions
GET /repos/{owner}/{repo}/actions/permissions/workflow
PUT /repos/{owner}/{repo}/actions/permissions/workflow
GET /repos/{owner}/{repo}/actions/policies
POST /repos/{owner}/{repo}/actions/policies
GET /repos/{owner}/{repo}/actions/policies/{policy_id}
PUT /repos/{owner}/{repo}/actions/policies/{policy_id}
DELETE /repos/{owner}/{repo}/actions/policies/{policy_id}
GET /repos/{owner}/{repo}/actions/runners
GET /repos/{owner}/{repo}/actions/runners/deprecations/{version}
GET /repos/{owner}/{repo}/actions/runners/downloads
POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig
POST /repos/{owner}/{repo}/actions/runners/registration-token
POST /repos/{owner}/{repo}/actions/runners/remove-token
GET /repos/{owner}/{repo}/actions/runners/{runner_id}
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}
GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}
GET /repos/{owner}/{repo}/actions/runs
GET /repos/{owner}/{repo}/actions/runs/{run_id}
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}
GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals
POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve
GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs
POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel
GET /repos/{owner}/{repo}/actions/runs/{run_id}/concurrency_groups
POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule
POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel
GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing
GET /repos/{owner}/{repo}/actions/secrets
GET /repos/{owner}/{repo}/actions/secrets/public-key
GET /repos/{owner}/{repo}/actions/secrets/{secret_name}
PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}
GET /repos/{owner}/{repo}/actions/variables
POST /repos/{owner}/{repo}/actions/variables
GET /repos/{owner}/{repo}/actions/variables/{name}
PATCH /repos/{owner}/{repo}/actions/variables/{name}
DELETE /repos/{owner}/{repo}/actions/variables/{name}
GET /repos/{owner}/{repo}/actions/workflows
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable
POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
GET /repos/{owner}/{repo}/environments/{environment_name}/variables
POST /repos/{owner}/{repo}/environments/{environment_name}/variables
GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
activity
GET /events
GET /feeds
GET /networks/{owner}/{repo}/events
GET /orgs/{org}/events
GET /repos/{owner}/{repo}/events
GET /repos/{owner}/{repo}/stargazers
GET /repos/{owner}/{repo}/stargazers/count
GET /repos/{owner}/{repo}/stargazers/history
GET /repos/{owner}/{repo}/subscribers
GET /users/{username}/events
GET /users/{username}/events/public
GET /users/{username}/received_events
GET /users/{username}/received_events/public
GET /users/{username}/starred
GET /users/{username}/subscriptions
agents
GET /orgs/{org}/agents/secrets
GET /orgs/{org}/agents/secrets/public-key
GET /orgs/{org}/agents/secrets/{secret_name}
PUT /orgs/{org}/agents/secrets/{secret_name}
DELETE /orgs/{org}/agents/secrets/{secret_name}
GET /orgs/{org}/agents/secrets/{secret_name}/repositories
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/agents/variables
POST /orgs/{org}/agents/variables
GET /orgs/{org}/agents/variables/{name}
PATCH /orgs/{org}/agents/variables/{name}
DELETE /orgs/{org}/agents/variables/{name}
GET /orgs/{org}/agents/variables/{name}/repositories
PUT /orgs/{org}/agents/variables/{name}/repositories
PUT /orgs/{org}/agents/variables/{name}/repositories/{repository_id}
DELETE /orgs/{org}/agents/variables/{name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/agents/organization-secrets
GET /repos/{owner}/{repo}/agents/organization-variables
GET /repos/{owner}/{repo}/agents/secrets
GET /repos/{owner}/{repo}/agents/secrets/public-key
GET /repos/{owner}/{repo}/agents/secrets/{secret_name}
PUT /repos/{owner}/{repo}/agents/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/agents/secrets/{secret_name}
GET /repos/{owner}/{repo}/agents/variables
POST /repos/{owner}/{repo}/agents/variables
GET /repos/{owner}/{repo}/agents/variables/{name}
PATCH /repos/{owner}/{repo}/agents/variables/{name}
DELETE /repos/{owner}/{repo}/agents/variables/{name}
apps
GET /apps/{app_slug}
GET /installation/repositories
DELETE /installation/token
PUT /user/installations/{installation_id}/repositories/{repository_id}
DELETE /user/installations/{installation_id}/repositories/{repository_id}
billing
GET /organizations/{org}/settings/billing/ai_credit/usage
GET /organizations/{org}/settings/billing/budgets
POST /organizations/{org}/settings/billing/budgets
GET /organizations/{org}/settings/billing/budgets/{budget_id}
PATCH /organizations/{org}/settings/billing/budgets/{budget_id}
DELETE /organizations/{org}/settings/billing/budgets/{budget_id}
GET /organizations/{org}/settings/billing/premium_request/usage
GET /organizations/{org}/settings/billing/usage
GET /organizations/{org}/settings/billing/usage/summary
branches
GET /repos/{owner}/{repo}/branches
GET /repos/{owner}/{repo}/branches/{branch}
GET /repos/{owner}/{repo}/branches/{branch}/protection
PUT /repos/{owner}/{repo}/branches/{branch}/protection
DELETE /repos/{owner}/{repo}/branches/{branch}/protection
GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
POST /repos/{owner}/{repo}/branches/{branch}/rename
POST /repos/{owner}/{repo}/merge-upstream
POST /repos/{owner}/{repo}/merges
campaigns
GET /orgs/{org}/campaigns
POST /orgs/{org}/campaigns
GET /orgs/{org}/campaigns/{campaign_number}
PATCH /orgs/{org}/campaigns/{campaign_number}
DELETE /orgs/{org}/campaigns/{campaign_number}
checks
POST /repos/{owner}/{repo}/check-runs
GET /repos/{owner}/{repo}/check-runs/{check_run_id}
PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}
GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations
POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest
POST /repos/{owner}/{repo}/check-suites
PATCH /repos/{owner}/{repo}/check-suites/preferences
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs
POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest
GET /repos/{owner}/{repo}/commits/{ref}/check-runs
GET /repos/{owner}/{repo}/commits/{ref}/check-suites
code-quality
GET /repos/{owner}/{repo}/code-quality/findings
GET /repos/{owner}/{repo}/code-quality/findings/{finding_number}
GET /repos/{owner}/{repo}/code-quality/setup
PATCH /repos/{owner}/{repo}/code-quality/setup
code-scanning
GET /orgs/{org}/code-scanning/ai-scan
PATCH /orgs/{org}/code-scanning/ai-scan
GET /orgs/{org}/code-scanning/alerts
GET /repos/{owner}/{repo}/code-scanning/ai-scan
PATCH /repos/{owner}/{repo}/code-scanning/ai-scan
GET /repos/{owner}/{repo}/code-scanning/alerts
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances
GET /repos/{owner}/{repo}/code-scanning/analyses
GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
GET /repos/{owner}/{repo}/code-scanning/codeql/databases
GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}
DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}
POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}
GET /repos/{owner}/{repo}/code-scanning/default-setup
PATCH /repos/{owner}/{repo}/code-scanning/default-setup
POST /repos/{owner}/{repo}/code-scanning/sarifs
GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}
code-security
GET /orgs/{org}/code-security/configurations
POST /orgs/{org}/code-security/configurations
GET /orgs/{org}/code-security/configurations/defaults
DELETE /orgs/{org}/code-security/configurations/detach
GET /orgs/{org}/code-security/configurations/{configuration_id}
PATCH /orgs/{org}/code-security/configurations/{configuration_id}
DELETE /orgs/{org}/code-security/configurations/{configuration_id}
POST /orgs/{org}/code-security/configurations/{configuration_id}/attach
PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults
GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories
GET /repos/{owner}/{repo}/code-security-configuration
codes-of-conduct
GET /codes_of_conduct
GET /codes_of_conduct/{key}
codespaces
GET /orgs/{org}/codespaces
PUT /orgs/{org}/codespaces/access
POST /orgs/{org}/codespaces/access/selected_users
DELETE /orgs/{org}/codespaces/access/selected_users
GET /orgs/{org}/codespaces/secrets
GET /orgs/{org}/codespaces/secrets/public-key
GET /orgs/{org}/codespaces/secrets/{secret_name}
PUT /orgs/{org}/codespaces/secrets/{secret_name}
DELETE /orgs/{org}/codespaces/secrets/{secret_name}
GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/members/{username}/codespaces
DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}
POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop
GET /repos/{owner}/{repo}/codespaces/devcontainers
GET /repos/{owner}/{repo}/codespaces/machines
GET /repos/{owner}/{repo}/codespaces/secrets
GET /repos/{owner}/{repo}/codespaces/secrets/public-key
GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
collaborators
GET /repos/{owner}/{repo}/collaborators
GET /repos/{owner}/{repo}/collaborators/{username}
PUT /repos/{owner}/{repo}/collaborators/{username}
DELETE /repos/{owner}/{repo}/collaborators/{username}
GET /repos/{owner}/{repo}/collaborators/{username}/permission
GET /repos/{owner}/{repo}/invitations
PATCH /repos/{owner}/{repo}/invitations/{invitation_id}
DELETE /repos/{owner}/{repo}/invitations/{invitation_id}
commits
GET /repos/{owner}/{repo}/comments
GET /repos/{owner}/{repo}/comments/{comment_id}
PATCH /repos/{owner}/{repo}/comments/{comment_id}
DELETE /repos/{owner}/{repo}/comments/{comment_id}
GET /repos/{owner}/{repo}/commits
GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head
GET /repos/{owner}/{repo}/commits/{commit_sha}/comments
POST /repos/{owner}/{repo}/commits/{commit_sha}/comments
GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls
GET /repos/{owner}/{repo}/commits/{ref}
GET /repos/{owner}/{repo}/commits/{ref}/status
GET /repos/{owner}/{repo}/commits/{ref}/statuses
GET /repos/{owner}/{repo}/compare/{basehead}
POST /repos/{owner}/{repo}/statuses/{sha}
copilot
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest
GET /enterprises/{enterprise}/copilot/metrics/reports/repos-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/user-teams-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/users-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest
GET /orgs/{org}/copilot/billing
GET /orgs/{org}/copilot/billing/seats
POST /orgs/{org}/copilot/billing/selected_teams
DELETE /orgs/{org}/copilot/billing/selected_teams
POST /orgs/{org}/copilot/billing/selected_users
DELETE /orgs/{org}/copilot/billing/selected_users
GET /orgs/{org}/copilot/coding-agent/permissions
PUT /orgs/{org}/copilot/coding-agent/permissions
GET /orgs/{org}/copilot/coding-agent/permissions/repositories
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}
DELETE /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}
GET /orgs/{org}/copilot/content_exclusion
PUT /orgs/{org}/copilot/content_exclusion
GET /orgs/{org}/copilot/metrics/reports/organization-1-day
GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest
GET /orgs/{org}/copilot/metrics/reports/repos-1-day
GET /orgs/{org}/copilot/metrics/reports/user-teams-1-day
GET /orgs/{org}/copilot/metrics/reports/users-1-day
GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest
GET /orgs/{org}/members/{username}/copilot
GET /repos/{owner}/{repo}/copilot/cloud-agent/configuration
copilot-spaces
GET /orgs/{org}/copilot-spaces
POST /orgs/{org}/copilot-spaces
GET /orgs/{org}/copilot-spaces/{space_number}
PUT /orgs/{org}/copilot-spaces/{space_number}
DELETE /orgs/{org}/copilot-spaces/{space_number}
GET /orgs/{org}/copilot-spaces/{space_number}/collaborators
POST /orgs/{org}/copilot-spaces/{space_number}/collaborators
PUT /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}
DELETE /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}
GET /orgs/{org}/copilot-spaces/{space_number}/resources
POST /orgs/{org}/copilot-spaces/{space_number}/resources
GET /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
PUT /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
DELETE /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
dependabot
GET /enterprises/{enterprise}/dependabot/repository-access
PATCH /enterprises/{enterprise}/dependabot/repository-access
PUT /enterprises/{enterprise}/dependabot/repository-access/default-level
GET /orgs/{org}/dependabot/alerts
GET /orgs/{org}/dependabot/repository-access
PATCH /orgs/{org}/dependabot/repository-access
PUT /orgs/{org}/dependabot/repository-access/default-level
GET /orgs/{org}/dependabot/secrets
GET /orgs/{org}/dependabot/secrets/public-key
GET /orgs/{org}/dependabot/secrets/{secret_name}
PUT /orgs/{org}/dependabot/secrets/{secret_name}
DELETE /orgs/{org}/dependabot/secrets/{secret_name}
GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/dependabot/alerts
GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
GET /repos/{owner}/{repo}/dependabot/secrets
GET /repos/{owner}/{repo}/dependabot/secrets/public-key
GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
dependency-graph
GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}
GET /repos/{owner}/{repo}/dependency-graph/sbom
GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{sbom_uuid}
GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report
POST /repos/{owner}/{repo}/dependency-graph/snapshots
deploy-keys
GET /repos/{owner}/{repo}/keys
POST /repos/{owner}/{repo}/keys
GET /repos/{owner}/{repo}/keys/{key_id}
DELETE /repos/{owner}/{repo}/keys/{key_id}
deployments
GET /repos/{owner}/{repo}/deployments
POST /repos/{owner}/{repo}/deployments
GET /repos/{owner}/{repo}/deployments/{deployment_id}
DELETE /repos/{owner}/{repo}/deployments/{deployment_id}
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}
GET /repos/{owner}/{repo}/environments
GET /repos/{owner}/{repo}/environments/{environment_name}
PUT /repos/{owner}/{repo}/environments/{environment_name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}
emojis
GET /emojis
git
POST /repos/{owner}/{repo}/git/blobs
GET /repos/{owner}/{repo}/git/blobs/{file_sha}
POST /repos/{owner}/{repo}/git/commits
GET /repos/{owner}/{repo}/git/commits/{commit_sha}
GET /repos/{owner}/{repo}/git/matching-refs/{ref}
GET /repos/{owner}/{repo}/git/ref/{ref}
POST /repos/{owner}/{repo}/git/refs
PATCH /repos/{owner}/{repo}/git/refs/{ref}
DELETE /repos/{owner}/{repo}/git/refs/{ref}
POST /repos/{owner}/{repo}/git/tags
GET /repos/{owner}/{repo}/git/tags/{tag_sha}
POST /repos/{owner}/{repo}/git/trees
GET /repos/{owner}/{repo}/git/trees/{tree_sha}
gitignore
GET /gitignore/templates
GET /gitignore/templates/{name}
interactions
GET /orgs/{org}/interaction-limits
PUT /orgs/{org}/interaction-limits
DELETE /orgs/{org}/interaction-limits
GET /orgs/{org}/interaction-limits/pulls/creation-cap
PATCH /orgs/{org}/interaction-limits/pulls/creation-cap
GET /repos/{owner}/{repo}/interaction-limits
PUT /repos/{owner}/{repo}/interaction-limits
DELETE /repos/{owner}/{repo}/interaction-limits
GET /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
PUT /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
DELETE /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
GET /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap
PATCH /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap
issues
GET /repos/{owner}/{repo}/assignees
GET /repos/{owner}/{repo}/assignees/{assignee}
GET /repos/{owner}/{repo}/issues
POST /repos/{owner}/{repo}/issues
GET /repos/{owner}/{repo}/issues/comments
GET /repos/{owner}/{repo}/issues/comments/{comment_id}
PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}
PUT /repos/{owner}/{repo}/issues/comments/{comment_id}/pin
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/pin
GET /repos/{owner}/{repo}/issues/events
GET /repos/{owner}/{repo}/issues/events/{event_id}
GET /repos/{owner}/{repo}/issues/{issue_number}
PATCH /repos/{owner}/{repo}/issues/{issue_number}
POST /repos/{owner}/{repo}/issues/{issue_number}/assignees
DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees
GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}
GET /repos/{owner}/{repo}/issues/{issue_number}/comments
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking
GET /repos/{owner}/{repo}/issues/{issue_number}/events
GET /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
POST /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
PUT /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
DELETE /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values/{issue_field_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/labels
POST /repos/{owner}/{repo}/issues/{issue_number}/labels
PUT /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}
PUT /repos/{owner}/{repo}/issues/{issue_number}/lock
DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock
GET /repos/{owner}/{repo}/issues/{issue_number}/parent
GET /repos/{owner}/{repo}/issues/{issue_number}/relates_to
POST /repos/{owner}/{repo}/issues/{issue_number}/relates_to
DELETE /repos/{owner}/{repo}/issues/{issue_number}/relates_to/{issue_id}
DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue
GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority
GET /repos/{owner}/{repo}/issues/{issue_number}/suggestions
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/approve
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/dismiss
GET /repos/{owner}/{repo}/issues/{issue_number}/timeline
GET /repos/{owner}/{repo}/labels
POST /repos/{owner}/{repo}/labels
GET /repos/{owner}/{repo}/labels/{name}
PATCH /repos/{owner}/{repo}/labels/{name}
DELETE /repos/{owner}/{repo}/labels/{name}
GET /repos/{owner}/{repo}/milestones
POST /repos/{owner}/{repo}/milestones
GET /repos/{owner}/{repo}/milestones/{milestone_number}
PATCH /repos/{owner}/{repo}/milestones/{milestone_number}
DELETE /repos/{owner}/{repo}/milestones/{milestone_number}
GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels
licenses
GET /licenses
GET /licenses/{license}
GET /repos/{owner}/{repo}/license
markdown
POST /markdown
POST /markdown/raw
meta
GET /
GET /meta
GET /octocat
GET /versions
GET /zen
metrics
GET /repos/{owner}/{repo}/community/profile
GET /repos/{owner}/{repo}/stats/code_frequency
GET /repos/{owner}/{repo}/stats/commit_activity
GET /repos/{owner}/{repo}/stats/contributors
GET /repos/{owner}/{repo}/stats/participation
GET /repos/{owner}/{repo}/stats/punch_card
GET /repos/{owner}/{repo}/traffic/clones
GET /repos/{owner}/{repo}/traffic/popular/paths
GET /repos/{owner}/{repo}/traffic/popular/referrers
GET /repos/{owner}/{repo}/traffic/views
orgs
GET /organizations
GET /orgs/{org}
PATCH /orgs/{org}
DELETE /orgs/{org}
POST /orgs/{org}/artifacts/metadata/deployment-record
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs
GET /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs/{job_id}
POST /orgs/{org}/artifacts/metadata/storage-record
GET /orgs/{org}/artifacts/{subject_digest}/metadata/deployment-records
GET /orgs/{org}/artifacts/{subject_digest}/metadata/storage-records
POST /orgs/{org}/attestations/bulk-list
POST /orgs/{org}/attestations/delete-request
DELETE /orgs/{org}/attestations/digest/{subject_digest}
GET /orgs/{org}/attestations/repositories
DELETE /orgs/{org}/attestations/{attestation_id}
GET /orgs/{org}/attestations/{subject_digest}
GET /orgs/{org}/blocks
GET /orgs/{org}/blocks/{username}
PUT /orgs/{org}/blocks/{username}
DELETE /orgs/{org}/blocks/{username}
GET /orgs/{org}/failed_invitations
GET /orgs/{org}/hooks
POST /orgs/{org}/hooks
GET /orgs/{org}/hooks/{hook_id}
PATCH /orgs/{org}/hooks/{hook_id}
DELETE /orgs/{org}/hooks/{hook_id}
GET /orgs/{org}/hooks/{hook_id}/config
PATCH /orgs/{org}/hooks/{hook_id}/config
GET /orgs/{org}/hooks/{hook_id}/deliveries
GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}
POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts
POST /orgs/{org}/hooks/{hook_id}/pings
GET /orgs/{org}/insights/api/route-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/subject-stats
GET /orgs/{org}/insights/api/summary-stats
GET /orgs/{org}/insights/api/summary-stats/users/{user_id}
GET /orgs/{org}/insights/api/summary-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/time-stats
GET /orgs/{org}/insights/api/time-stats/users/{user_id}
GET /orgs/{org}/insights/api/time-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/user-stats/{user_id}
GET /orgs/{org}/installations
GET /orgs/{org}/invitations
POST /orgs/{org}/invitations
DELETE /orgs/{org}/invitations/{invitation_id}
GET /orgs/{org}/invitations/{invitation_id}/teams
GET /orgs/{org}/issue-fields
POST /orgs/{org}/issue-fields
PATCH /orgs/{org}/issue-fields/{issue_field_id}
DELETE /orgs/{org}/issue-fields/{issue_field_id}
GET /orgs/{org}/issue-types
POST /orgs/{org}/issue-types
PUT /orgs/{org}/issue-types/{issue_type_id}
DELETE /orgs/{org}/issue-types/{issue_type_id}
GET /orgs/{org}/members
GET /orgs/{org}/members/{username}
DELETE /orgs/{org}/members/{username}
GET /orgs/{org}/memberships/{username}
PUT /orgs/{org}/memberships/{username}
DELETE /orgs/{org}/memberships/{username}
GET /orgs/{org}/organization-roles
DELETE /orgs/{org}/organization-roles/teams/{team_slug}
PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}
DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}
DELETE /orgs/{org}/organization-roles/users/{username}
PUT /orgs/{org}/organization-roles/users/{username}/{role_id}
DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}
GET /orgs/{org}/organization-roles/{role_id}
GET /orgs/{org}/organization-roles/{role_id}/teams
GET /orgs/{org}/organization-roles/{role_id}/users
GET /orgs/{org}/outside_collaborators
PUT /orgs/{org}/outside_collaborators/{username}
DELETE /orgs/{org}/outside_collaborators/{username}
GET /orgs/{org}/personal-access-token-requests
POST /orgs/{org}/personal-access-token-requests
POST /orgs/{org}/personal-access-token-requests/{pat_request_id}
GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories
GET /orgs/{org}/personal-access-tokens
POST /orgs/{org}/personal-access-tokens
POST /orgs/{org}/personal-access-tokens/{pat_id}
GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories
GET /orgs/{org}/properties/installations
POST /orgs/{org}/properties/installations
GET /orgs/{org}/properties/installations/schema
PATCH /orgs/{org}/properties/installations/values
PATCH /orgs/{org}/properties/installations/values/{property_name}
DELETE /orgs/{org}/properties/installations/values/{property_name}
GET /orgs/{org}/properties/schema
PATCH /orgs/{org}/properties/schema
GET /orgs/{org}/properties/schema/{custom_property_name}
PUT /orgs/{org}/properties/schema/{custom_property_name}
DELETE /orgs/{org}/properties/schema/{custom_property_name}
GET /orgs/{org}/properties/values
PATCH /orgs/{org}/properties/values
GET /orgs/{org}/public_members
GET /orgs/{org}/public_members/{username}
GET /orgs/{org}/rulesets
POST /orgs/{org}/rulesets
GET /orgs/{org}/rulesets/rule-suites
GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}
GET /orgs/{org}/rulesets/{ruleset_id}
PUT /orgs/{org}/rulesets/{ruleset_id}
DELETE /orgs/{org}/rulesets/{ruleset_id}
GET /orgs/{org}/rulesets/{ruleset_id}/history
GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}
GET /orgs/{org}/security-managers
PUT /orgs/{org}/security-managers/teams/{team_slug}
DELETE /orgs/{org}/security-managers/teams/{team_slug}
GET /orgs/{org}/settings/immutable-releases
PUT /orgs/{org}/settings/immutable-releases
GET /orgs/{org}/settings/immutable-releases/repositories
PUT /orgs/{org}/settings/immutable-releases/repositories
PUT /orgs/{org}/settings/immutable-releases/repositories/{repository_id}
DELETE /orgs/{org}/settings/immutable-releases/repositories/{repository_id}
GET /orgs/{org}/settings/network-configurations
POST /orgs/{org}/settings/network-configurations
GET /orgs/{org}/settings/network-configurations/{network_configuration_id}
PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}
DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}
GET /orgs/{org}/settings/network-settings/{network_settings_id}
POST /orgs/{org}/{security_product}/{enablement}
GET /users/{username}/orgs
packages
GET /orgs/{org}/docker/conflicts
GET /orgs/{org}/packages
GET /orgs/{org}/packages/{package_type}/{package_name}
DELETE /orgs/{org}/packages/{package_type}/{package_name}
POST /orgs/{org}/packages/{package_type}/{package_name}/restore
GET /orgs/{org}/packages/{package_type}/{package_name}/versions
GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}
DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}
POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore
GET /user/packages
GET /user/packages/{package_type}/{package_name}
DELETE /user/packages/{package_type}/{package_name}
POST /user/packages/{package_type}/{package_name}/restore
GET /user/packages/{package_type}/{package_name}/versions
GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}
DELETE /user/packages/{package_type}/{package_name}/versions/{package_version_id}
POST /user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore
GET /users/{username}/docker/conflicts
GET /users/{username}/packages
GET /users/{username}/packages/{package_type}/{package_name}
DELETE /users/{username}/packages/{package_type}/{package_name}
POST /users/{username}/packages/{package_type}/{package_name}/restore
GET /users/{username}/packages/{package_type}/{package_name}/versions
GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}
DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}
POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore
pages
GET /repos/{owner}/{repo}/pages
POST /repos/{owner}/{repo}/pages
PUT /repos/{owner}/{repo}/pages
DELETE /repos/{owner}/{repo}/pages
GET /repos/{owner}/{repo}/pages/builds
POST /repos/{owner}/{repo}/pages/builds
GET /repos/{owner}/{repo}/pages/builds/latest
GET /repos/{owner}/{repo}/pages/builds/{build_id}
POST /repos/{owner}/{repo}/pages/deployments
GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}
POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel
GET /repos/{owner}/{repo}/pages/health
private-registries
GET /orgs/{org}/private-registries
POST /orgs/{org}/private-registries
GET /orgs/{org}/private-registries/public-key
GET /orgs/{org}/private-registries/{secret_name}
PATCH /orgs/{org}/private-registries/{secret_name}
DELETE /orgs/{org}/private-registries/{secret_name}
projects
GET /orgs/{org}/projectsV2
GET /orgs/{org}/projectsV2/{project_number}
POST /orgs/{org}/projectsV2/{project_number}/drafts
GET /orgs/{org}/projectsV2/{project_number}/fields
POST /orgs/{org}/projectsV2/{project_number}/fields
GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}
GET /orgs/{org}/projectsV2/{project_number}/items
POST /orgs/{org}/projectsV2/{project_number}/items
GET /orgs/{org}/projectsV2/{project_number}/items/{item_id}
PATCH /orgs/{org}/projectsV2/{project_number}/items/{item_id}
DELETE /orgs/{org}/projectsV2/{project_number}/items/{item_id}
POST /orgs/{org}/projectsV2/{project_number}/views
GET /orgs/{org}/projectsV2/{project_number}/views/{view_number}/items
pulls
GET /repos/{owner}/{repo}/pulls
POST /repos/{owner}/{repo}/pulls
GET /repos/{owner}/{repo}/pulls/comments
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}
PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}
GET /repos/{owner}/{repo}/pulls/{pull_number}
PATCH /repos/{owner}/{repo}/pulls/{pull_number}
GET /repos/{owner}/{repo}/pulls/{pull_number}/comments
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies
GET /repos/{owner}/{repo}/pulls/{pull_number}/commits
GET /repos/{owner}/{repo}/pulls/{pull_number}/files
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}
GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers/rerequest
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events
PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch
GET /repos/{owner}/{repo}/stacks
POST /repos/{owner}/{repo}/stacks
GET /repos/{owner}/{repo}/stacks/{stack_number}
POST /repos/{owner}/{repo}/stacks/{stack_number}/add
POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack
rate-limit
GET /rate_limit
reactions
GET /repos/{owner}/{repo}/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/reactions
POST /repos/{owner}/{repo}/issues/{issue_number}/reactions
DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/releases/{release_id}/reactions
POST /repos/{owner}/{repo}/releases/{release_id}/reactions
DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}
releases
GET /repos/{owner}/{repo}/releases
POST /repos/{owner}/{repo}/releases
GET /repos/{owner}/{repo}/releases/assets/{asset_id}
PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}
DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}
POST /repos/{owner}/{repo}/releases/generate-notes
GET /repos/{owner}/{repo}/releases/latest
GET /repos/{owner}/{repo}/releases/tags/{tag}
GET /repos/{owner}/{repo}/releases/{release_id}
PATCH /repos/{owner}/{repo}/releases/{release_id}
DELETE /repos/{owner}/{repo}/releases/{release_id}
GET /repos/{owner}/{repo}/releases/{release_id}/assets
repos
GET /orgs/{org}/repos
POST /orgs/{org}/repos
GET /repos/{owner}/{repo}
PATCH /repos/{owner}/{repo}
DELETE /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/activity
POST /repos/{owner}/{repo}/attestations
GET /repos/{owner}/{repo}/attestations/{subject_digest}
GET /repos/{owner}/{repo}/autolinks
POST /repos/{owner}/{repo}/autolinks
GET /repos/{owner}/{repo}/autolinks/{autolink_id}
DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}
GET /repos/{owner}/{repo}/automated-security-fixes
PUT /repos/{owner}/{repo}/automated-security-fixes
DELETE /repos/{owner}/{repo}/automated-security-fixes
GET /repos/{owner}/{repo}/codeowners/errors
GET /repos/{owner}/{repo}/contents/{path}
PUT /repos/{owner}/{repo}/contents/{path}
DELETE /repos/{owner}/{repo}/contents/{path}
GET /repos/{owner}/{repo}/contributors
POST /repos/{owner}/{repo}/dispatches
GET /repos/{owner}/{repo}/forks
POST /repos/{owner}/{repo}/forks
GET /repos/{owner}/{repo}/hash-algorithm
GET /repos/{owner}/{repo}/hooks
POST /repos/{owner}/{repo}/hooks
GET /repos/{owner}/{repo}/hooks/{hook_id}
PATCH /repos/{owner}/{repo}/hooks/{hook_id}
DELETE /repos/{owner}/{repo}/hooks/{hook_id}
GET /repos/{owner}/{repo}/hooks/{hook_id}/config
PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}
POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts
POST /repos/{owner}/{repo}/hooks/{hook_id}/pings
POST /repos/{owner}/{repo}/hooks/{hook_id}/tests
GET /repos/{owner}/{repo}/immutable-releases
PUT /repos/{owner}/{repo}/immutable-releases
DELETE /repos/{owner}/{repo}/immutable-releases
GET /repos/{owner}/{repo}/issue-types
GET /repos/{owner}/{repo}/languages
GET /repos/{owner}/{repo}/private-vulnerability-reporting
PUT /repos/{owner}/{repo}/private-vulnerability-reporting
DELETE /repos/{owner}/{repo}/private-vulnerability-reporting
GET /repos/{owner}/{repo}/properties/values
PATCH /repos/{owner}/{repo}/properties/values
GET /repos/{owner}/{repo}/readme
GET /repos/{owner}/{repo}/readme/{dir}
GET /repos/{owner}/{repo}/rules/branches/{branch}
GET /repos/{owner}/{repo}/rulesets
POST /repos/{owner}/{repo}/rulesets
GET /repos/{owner}/{repo}/rulesets/rule-suites
GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}
PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}
DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}
GET /repos/{owner}/{repo}/tags
GET /repos/{owner}/{repo}/tarball/{ref}
GET /repos/{owner}/{repo}/teams
GET /repos/{owner}/{repo}/topics
PUT /repos/{owner}/{repo}/topics
GET /repos/{owner}/{repo}/vulnerability-alerts
PUT /repos/{owner}/{repo}/vulnerability-alerts
DELETE /repos/{owner}/{repo}/vulnerability-alerts
GET /repos/{owner}/{repo}/zipball/{ref}
POST /repos/{template_owner}/{template_repo}/generate
GET /repositories
POST /user/repos
GET /users/{username}/repos
search
GET /search/code
GET /search/commits
GET /search/issues
GET /search/labels
GET /search/repositories
GET /search/topics
GET /search/users
secret-scanning
GET /orgs/{org}/secret-scanning/alerts
GET /orgs/{org}/secret-scanning/custom-patterns
POST /orgs/{org}/secret-scanning/custom-patterns
DELETE /orgs/{org}/secret-scanning/custom-patterns
PATCH /orgs/{org}/secret-scanning/custom-patterns/{pattern_id}
GET /orgs/{org}/secret-scanning/pattern-configurations
PATCH /orgs/{org}/secret-scanning/pattern-configurations
GET /repos/{owner}/{repo}/secret-scanning/alerts
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations
GET /repos/{owner}/{repo}/secret-scanning/custom-patterns
POST /repos/{owner}/{repo}/secret-scanning/custom-patterns
DELETE /repos/{owner}/{repo}/secret-scanning/custom-patterns
PATCH /repos/{owner}/{repo}/secret-scanning/custom-patterns/{pattern_id}
GET /repos/{owner}/{repo}/secret-scanning/scan-history
security-advisories
GET /advisories
GET /advisories/{ghsa_id}
GET /orgs/{org}/security-advisories
GET /repos/{owner}/{repo}/security-advisories
POST /repos/{owner}/{repo}/security-advisories
POST /repos/{owner}/{repo}/security-advisories/reports
GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}
PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks
teams
GET /orgs/{org}/teams
POST /orgs/{org}/teams
GET /orgs/{org}/teams/{team_slug}
PATCH /orgs/{org}/teams/{team_slug}
DELETE /orgs/{org}/teams/{team_slug}
GET /orgs/{org}/teams/{team_slug}/invitations
GET /orgs/{org}/teams/{team_slug}/members
GET /orgs/{org}/teams/{team_slug}/memberships/{username}
PUT /orgs/{org}/teams/{team_slug}/memberships/{username}
DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}
GET /orgs/{org}/teams/{team_slug}/repos
GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
GET /orgs/{org}/teams/{team_slug}/teams
GET /teams/{team_id}
PATCH /teams/{team_id}
DELETE /teams/{team_id}
GET /teams/{team_id}/invitations
GET /teams/{team_id}/members
GET /teams/{team_id}/members/{username}
PUT /teams/{team_id}/members/{username}
DELETE /teams/{team_id}/members/{username}
GET /teams/{team_id}/memberships/{username}
PUT /teams/{team_id}/memberships/{username}
DELETE /teams/{team_id}/memberships/{username}
GET /teams/{team_id}/repos
GET /teams/{team_id}/repos/{owner}/{repo}
PUT /teams/{team_id}/repos/{owner}/{repo}
DELETE /teams/{team_id}/repos/{owner}/{repo}
GET /teams/{team_id}/teams
users
GET /user/{account_id}
GET /users
GET /users/{username}
POST /users/{username}/attestations/bulk-list
POST /users/{username}/attestations/delete-request
DELETE /users/{username}/attestations/digest/{subject_digest}
DELETE /users/{username}/attestations/{attestation_id}
GET /users/{username}/attestations/{subject_digest}
GET /users/{username}/followers
GET /users/{username}/following
GET /users/{username}/following/{target_user}
GET /users/{username}/gpg_keys
GET /users/{username}/keys
GET /users/{username}/social_accounts
GET /users/{username}/ssh_signing_keys

Skip to main content
GitHub Docs
Select your plan:

Search or ask Copilot
/

HomeREST APIAuthenticationEndpoints for GitHub App user tokens
REST API
Quickstart

About the REST API
About the REST API
Comparing GitHub's APIs
API Versions
Breaking changes
OpenAPI description

Using the REST API
Getting started
Rate limits
Pagination
Libraries
Best practices
Troubleshooting
Timezones
CORS and JSONP
Issue event types
GitHub event types

Authentication
Authenticating
Keeping API credentials secure
Endpoints for GitHub App installation tokens
Endpoints for GitHub App user tokens
Endpoints for fine-grained PATs
Permissions for GitHub Apps
Permissions for fine-grained PATs

Guides

Actions

Activity

Agent tasks

Agents

Apps

Billing

Branches

Campaigns

Checks

Classroom

Code quality

Code scanning

Code security settings

Codes of conduct

Codespaces

Collaborators

Commits

Copilot

Copilot Spaces

Credentials

Dependabot

Dependency graph

Deploy keys

Deployments

Emojis

Gists

Git database

Gitignore

Interactions

Issues

Licenses

Markdown

Meta

Metrics

Migrations

Organizations

Packages

Pages

Private registries

Projects

Pull requests

Rate limit

Reactions

Releases

Repositories

Search

Secret scanning

Security advisories

Teams

Users
Endpoints available for GitHub App user access tokens
Your GitHub App can make requests to the following REST endpoints with a user access token.

Who can use this feature?
You can use a user access token to access these endpoints using your GitHub App. For more information, see Authenticating with a GitHub App on behalf of a user.

In this article
actions
activity
agents
apps
billing
branches
campaigns
checks
code-quality
code-scanning
code-security
codes-of-conduct
codespaces
collaborators
commits
copilot
copilot-spaces
dependabot
dependency-graph
deploy-keys
deployments
emojis
gists
git
gitignore
interactions
issues
licenses
markdown
meta
metrics
migrations
orgs
packages
pages
private-registries
projects
pulls
rate-limit
reactions
releases
repos
search
secret-scanning
security-advisories
teams
users
actions
GET /enterprises/{enterprise}/actions/cache/retention-limit
PUT /enterprises/{enterprise}/actions/cache/retention-limit
GET /enterprises/{enterprise}/actions/cache/storage-limit
PUT /enterprises/{enterprise}/actions/cache/storage-limit
GET /enterprises/{enterprise}/actions/oidc/customization/properties/repo
POST /enterprises/{enterprise}/actions/oidc/customization/properties/repo
DELETE /enterprises/{enterprise}/actions/oidc/customization/properties/repo/{custom_property_name}
GET /organizations/{org}/actions/cache/retention-limit
PUT /organizations/{org}/actions/cache/retention-limit
GET /organizations/{org}/actions/cache/storage-limit
PUT /organizations/{org}/actions/cache/storage-limit
GET /orgs/{org}/actions/cache/usage
GET /orgs/{org}/actions/cache/usage-by-repository
GET /orgs/{org}/actions/hosted-runners
POST /orgs/{org}/actions/hosted-runners
GET /orgs/{org}/actions/hosted-runners/images/custom
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}
GET /orgs/{org}/actions/hosted-runners/images/github-owned
GET /orgs/{org}/actions/hosted-runners/images/partner
GET /orgs/{org}/actions/hosted-runners/limits
GET /orgs/{org}/actions/hosted-runners/machine-sizes
GET /orgs/{org}/actions/hosted-runners/platforms
GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}
GET /orgs/{org}/actions/oidc/customization/properties/repo
POST /orgs/{org}/actions/oidc/customization/properties/repo
DELETE /orgs/{org}/actions/oidc/customization/properties/repo/{custom_property_name}
GET /orgs/{org}/actions/oidc/customization/sub
PUT /orgs/{org}/actions/oidc/customization/sub
GET /orgs/{org}/actions/permissions
PUT /orgs/{org}/actions/permissions
GET /orgs/{org}/actions/permissions/artifact-and-log-retention
PUT /orgs/{org}/actions/permissions/artifact-and-log-retention
GET /orgs/{org}/actions/permissions/fork-pr-contributor-approval
PUT /orgs/{org}/actions/permissions/fork-pr-contributor-approval
GET /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos
PUT /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos
GET /orgs/{org}/actions/permissions/repositories
PUT /orgs/{org}/actions/permissions/repositories
PUT /orgs/{org}/actions/permissions/repositories/{repository_id}
DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}
GET /orgs/{org}/actions/permissions/selected-actions
PUT /orgs/{org}/actions/permissions/selected-actions
GET /orgs/{org}/actions/permissions/self-hosted-runners
PUT /orgs/{org}/actions/permissions/self-hosted-runners
GET /orgs/{org}/actions/permissions/self-hosted-runners/repositories
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}
DELETE /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}
GET /orgs/{org}/actions/permissions/workflow
PUT /orgs/{org}/actions/permissions/workflow
GET /orgs/{org}/actions/policies
POST /orgs/{org}/actions/policies
GET /orgs/{org}/actions/policies/{policy_id}
PUT /orgs/{org}/actions/policies/{policy_id}
DELETE /orgs/{org}/actions/policies/{policy_id}
GET /orgs/{org}/actions/runner-groups
POST /orgs/{org}/actions/runner-groups
GET /orgs/{org}/actions/runner-groups/{runner_group_id}
PATCH /orgs/{org}/actions/runner-groups/{runner_group_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}
GET /orgs/{org}/actions/runners
GET /orgs/{org}/actions/runners/deprecations/{version}
GET /orgs/{org}/actions/runners/downloads
POST /orgs/{org}/actions/runners/generate-jitconfig
POST /orgs/{org}/actions/runners/registration-token
POST /orgs/{org}/actions/runners/remove-token
GET /orgs/{org}/actions/runners/{runner_id}
DELETE /orgs/{org}/actions/runners/{runner_id}
GET /orgs/{org}/actions/runners/{runner_id}/labels
POST /orgs/{org}/actions/runners/{runner_id}/labels
PUT /orgs/{org}/actions/runners/{runner_id}/labels
DELETE /orgs/{org}/actions/runners/{runner_id}/labels
DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}
GET /orgs/{org}/actions/secrets
GET /orgs/{org}/actions/secrets/public-key
GET /orgs/{org}/actions/secrets/{secret_name}
PUT /orgs/{org}/actions/secrets/{secret_name}
DELETE /orgs/{org}/actions/secrets/{secret_name}
GET /orgs/{org}/actions/secrets/{secret_name}/repositories
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/actions/variables
POST /orgs/{org}/actions/variables
GET /orgs/{org}/actions/variables/{name}
PATCH /orgs/{org}/actions/variables/{name}
DELETE /orgs/{org}/actions/variables/{name}
GET /orgs/{org}/actions/variables/{name}/repositories
PUT /orgs/{org}/actions/variables/{name}/repositories
PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/actions/artifacts
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}
GET /repos/{owner}/{repo}/actions/cache/retention-limit
PUT /repos/{owner}/{repo}/actions/cache/retention-limit
GET /repos/{owner}/{repo}/actions/cache/storage-limit
PUT /repos/{owner}/{repo}/actions/cache/storage-limit
GET /repos/{owner}/{repo}/actions/cache/usage
GET /repos/{owner}/{repo}/actions/caches
DELETE /repos/{owner}/{repo}/actions/caches
DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}
GET /repos/{owner}/{repo}/actions/concurrency_groups
GET /repos/{owner}/{repo}/actions/concurrency_groups/{concurrency_group_name}
GET /repos/{owner}/{repo}/actions/jobs/{job_id}
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/steps/{step_number}/logs
GET /repos/{owner}/{repo}/actions/oidc/customization/sub
PUT /repos/{owner}/{repo}/actions/oidc/customization/sub
GET /repos/{owner}/{repo}/actions/organization-secrets
GET /repos/{owner}/{repo}/actions/organization-variables
GET /repos/{owner}/{repo}/actions/permissions
PUT /repos/{owner}/{repo}/actions/permissions
GET /repos/{owner}/{repo}/actions/permissions/access
PUT /repos/{owner}/{repo}/actions/permissions/access
GET /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention
PUT /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos
GET /repos/{owner}/{repo}/actions/permissions/selected-actions
PUT /repos/{owner}/{repo}/actions/permissions/selected-actions
GET /repos/{owner}/{repo}/actions/permissions/workflow
PUT /repos/{owner}/{repo}/actions/permissions/workflow
GET /repos/{owner}/{repo}/actions/policies
POST /repos/{owner}/{repo}/actions/policies
GET /repos/{owner}/{repo}/actions/policies/{policy_id}
PUT /repos/{owner}/{repo}/actions/policies/{policy_id}
DELETE /repos/{owner}/{repo}/actions/policies/{policy_id}
GET /repos/{owner}/{repo}/actions/runners
GET /repos/{owner}/{repo}/actions/runners/deprecations/{version}
GET /repos/{owner}/{repo}/actions/runners/downloads
POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig
POST /repos/{owner}/{repo}/actions/runners/registration-token
POST /repos/{owner}/{repo}/actions/runners/remove-token
GET /repos/{owner}/{repo}/actions/runners/{runner_id}
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}
GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}
GET /repos/{owner}/{repo}/actions/runs
GET /repos/{owner}/{repo}/actions/runs/{run_id}
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}
GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals
POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve
GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs
POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel
GET /repos/{owner}/{repo}/actions/runs/{run_id}/concurrency_groups
POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel
GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs
GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing
GET /repos/{owner}/{repo}/actions/secrets
GET /repos/{owner}/{repo}/actions/secrets/public-key
GET /repos/{owner}/{repo}/actions/secrets/{secret_name}
PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}
GET /repos/{owner}/{repo}/actions/variables
POST /repos/{owner}/{repo}/actions/variables
GET /repos/{owner}/{repo}/actions/variables/{name}
PATCH /repos/{owner}/{repo}/actions/variables/{name}
DELETE /repos/{owner}/{repo}/actions/variables/{name}
GET /repos/{owner}/{repo}/actions/workflows
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable
POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}
GET /repos/{owner}/{repo}/environments/{environment_name}/variables
POST /repos/{owner}/{repo}/environments/{environment_name}/variables
GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}
activity
GET /events
GET /feeds
GET /networks/{owner}/{repo}/events
GET /orgs/{org}/events
GET /repos/{owner}/{repo}/events
GET /repos/{owner}/{repo}/stargazers
GET /repos/{owner}/{repo}/stargazers/count
GET /repos/{owner}/{repo}/stargazers/history
GET /repos/{owner}/{repo}/subscribers
GET /user/starred
GET /user/starred/{owner}/{repo}
PUT /user/starred/{owner}/{repo}
DELETE /user/starred/{owner}/{repo}
GET /user/subscriptions
GET /users/{username}/events
GET /users/{username}/events/orgs/{org}
GET /users/{username}/events/public
GET /users/{username}/received_events
GET /users/{username}/received_events/public
GET /users/{username}/starred
GET /users/{username}/subscriptions
agents
GET /orgs/{org}/agents/secrets
GET /orgs/{org}/agents/secrets/public-key
GET /orgs/{org}/agents/secrets/{secret_name}
PUT /orgs/{org}/agents/secrets/{secret_name}
DELETE /orgs/{org}/agents/secrets/{secret_name}
GET /orgs/{org}/agents/secrets/{secret_name}/repositories
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/agents/variables
POST /orgs/{org}/agents/variables
GET /orgs/{org}/agents/variables/{name}
PATCH /orgs/{org}/agents/variables/{name}
DELETE /orgs/{org}/agents/variables/{name}
GET /orgs/{org}/agents/variables/{name}/repositories
PUT /orgs/{org}/agents/variables/{name}/repositories
PUT /orgs/{org}/agents/variables/{name}/repositories/{repository_id}
DELETE /orgs/{org}/agents/variables/{name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/agents/organization-secrets
GET /repos/{owner}/{repo}/agents/organization-variables
GET /repos/{owner}/{repo}/agents/secrets
GET /repos/{owner}/{repo}/agents/secrets/public-key
GET /repos/{owner}/{repo}/agents/secrets/{secret_name}
PUT /repos/{owner}/{repo}/agents/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/agents/secrets/{secret_name}
GET /repos/{owner}/{repo}/agents/variables
POST /repos/{owner}/{repo}/agents/variables
GET /repos/{owner}/{repo}/agents/variables/{name}
PATCH /repos/{owner}/{repo}/agents/variables/{name}
DELETE /repos/{owner}/{repo}/agents/variables/{name}
apps
GET /apps/{app_slug}
GET /user/installations
GET /user/installations/{installation_id}/repositories
PUT /user/installations/{installation_id}/repositories/{repository_id}
DELETE /user/installations/{installation_id}/repositories/{repository_id}
GET /user/marketplace_purchases
GET /user/marketplace_purchases/stubbed
billing
GET /organizations/{org}/settings/billing/ai_credit/usage
GET /organizations/{org}/settings/billing/budgets
POST /organizations/{org}/settings/billing/budgets
GET /organizations/{org}/settings/billing/budgets/{budget_id}
PATCH /organizations/{org}/settings/billing/budgets/{budget_id}
DELETE /organizations/{org}/settings/billing/budgets/{budget_id}
GET /organizations/{org}/settings/billing/premium_request/usage
GET /organizations/{org}/settings/billing/usage
GET /organizations/{org}/settings/billing/usage/summary
GET /users/{username}/settings/billing/ai_credit/usage
GET /users/{username}/settings/billing/premium_request/usage
GET /users/{username}/settings/billing/usage
GET /users/{username}/settings/billing/usage/summary
branches
GET /repos/{owner}/{repo}/branches
GET /repos/{owner}/{repo}/branches/{branch}
GET /repos/{owner}/{repo}/branches/{branch}/protection
PUT /repos/{owner}/{repo}/branches/{branch}/protection
DELETE /repos/{owner}/{repo}/branches/{branch}/protection
GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users
POST /repos/{owner}/{repo}/branches/{branch}/rename
POST /repos/{owner}/{repo}/merge-upstream
POST /repos/{owner}/{repo}/merges
campaigns
GET /orgs/{org}/campaigns
POST /orgs/{org}/campaigns
GET /orgs/{org}/campaigns/{campaign_number}
PATCH /orgs/{org}/campaigns/{campaign_number}
DELETE /orgs/{org}/campaigns/{campaign_number}
checks
POST /repos/{owner}/{repo}/check-runs
GET /repos/{owner}/{repo}/check-runs/{check_run_id}
PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}
GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations
POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest
POST /repos/{owner}/{repo}/check-suites
PATCH /repos/{owner}/{repo}/check-suites/preferences
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs
POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest
GET /repos/{owner}/{repo}/commits/{ref}/check-runs
GET /repos/{owner}/{repo}/commits/{ref}/check-suites
code-quality
GET /repos/{owner}/{repo}/code-quality/findings
GET /repos/{owner}/{repo}/code-quality/findings/{finding_number}
GET /repos/{owner}/{repo}/code-quality/setup
PATCH /repos/{owner}/{repo}/code-quality/setup
code-scanning
GET /orgs/{org}/code-scanning/ai-scan
PATCH /orgs/{org}/code-scanning/ai-scan
GET /orgs/{org}/code-scanning/alerts
GET /repos/{owner}/{repo}/code-scanning/ai-scan
PATCH /repos/{owner}/{repo}/code-scanning/ai-scan
GET /repos/{owner}/{repo}/code-scanning/alerts
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances
GET /repos/{owner}/{repo}/code-scanning/analyses
GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}
GET /repos/{owner}/{repo}/code-scanning/codeql/databases
GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}
DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}
POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}
GET /repos/{owner}/{repo}/code-scanning/default-setup
PATCH /repos/{owner}/{repo}/code-scanning/default-setup
POST /repos/{owner}/{repo}/code-scanning/sarifs
GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}
code-security
GET /orgs/{org}/code-security/configurations
POST /orgs/{org}/code-security/configurations
GET /orgs/{org}/code-security/configurations/defaults
DELETE /orgs/{org}/code-security/configurations/detach
GET /orgs/{org}/code-security/configurations/{configuration_id}
PATCH /orgs/{org}/code-security/configurations/{configuration_id}
DELETE /orgs/{org}/code-security/configurations/{configuration_id}
POST /orgs/{org}/code-security/configurations/{configuration_id}/attach
PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults
GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories
GET /repos/{owner}/{repo}/code-security-configuration
codes-of-conduct
GET /codes_of_conduct
GET /codes_of_conduct/{key}
codespaces
GET /orgs/{org}/codespaces
PUT /orgs/{org}/codespaces/access
POST /orgs/{org}/codespaces/access/selected_users
DELETE /orgs/{org}/codespaces/access/selected_users
GET /orgs/{org}/codespaces/secrets
GET /orgs/{org}/codespaces/secrets/public-key
GET /orgs/{org}/codespaces/secrets/{secret_name}
PUT /orgs/{org}/codespaces/secrets/{secret_name}
DELETE /orgs/{org}/codespaces/secrets/{secret_name}
GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}
GET /orgs/{org}/members/{username}/codespaces
DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}
POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop
GET /repos/{owner}/{repo}/codespaces
POST /repos/{owner}/{repo}/codespaces
GET /repos/{owner}/{repo}/codespaces/devcontainers
GET /repos/{owner}/{repo}/codespaces/machines
GET /repos/{owner}/{repo}/codespaces/new
GET /repos/{owner}/{repo}/codespaces/permissions_check
GET /repos/{owner}/{repo}/codespaces/secrets
GET /repos/{owner}/{repo}/codespaces/secrets/public-key
GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}
POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces
GET /user/codespaces
POST /user/codespaces
GET /user/codespaces/secrets
GET /user/codespaces/secrets/public-key
GET /user/codespaces/secrets/{secret_name}
PUT /user/codespaces/secrets/{secret_name}
DELETE /user/codespaces/secrets/{secret_name}
GET /user/codespaces/secrets/{secret_name}/repositories
PUT /user/codespaces/secrets/{secret_name}/repositories
PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}
DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}
GET /user/codespaces/{codespace_name}
PATCH /user/codespaces/{codespace_name}
DELETE /user/codespaces/{codespace_name}
POST /user/codespaces/{codespace_name}/exports
GET /user/codespaces/{codespace_name}/exports/{export_id}
GET /user/codespaces/{codespace_name}/machines
POST /user/codespaces/{codespace_name}/publish
POST /user/codespaces/{codespace_name}/start
POST /user/codespaces/{codespace_name}/stop
collaborators
GET /repos/{owner}/{repo}/collaborators
GET /repos/{owner}/{repo}/collaborators/{username}
PUT /repos/{owner}/{repo}/collaborators/{username}
DELETE /repos/{owner}/{repo}/collaborators/{username}
GET /repos/{owner}/{repo}/collaborators/{username}/permission
GET /repos/{owner}/{repo}/invitations
PATCH /repos/{owner}/{repo}/invitations/{invitation_id}
DELETE /repos/{owner}/{repo}/invitations/{invitation_id}
GET /user/repository_invitations
PATCH /user/repository_invitations/{invitation_id}
DELETE /user/repository_invitations/{invitation_id}
commits
GET /repos/{owner}/{repo}/comments
GET /repos/{owner}/{repo}/comments/{comment_id}
PATCH /repos/{owner}/{repo}/comments/{comment_id}
DELETE /repos/{owner}/{repo}/comments/{comment_id}
GET /repos/{owner}/{repo}/commits
GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head
GET /repos/{owner}/{repo}/commits/{commit_sha}/comments
POST /repos/{owner}/{repo}/commits/{commit_sha}/comments
GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls
GET /repos/{owner}/{repo}/commits/{ref}
GET /repos/{owner}/{repo}/commits/{ref}/status
GET /repos/{owner}/{repo}/commits/{ref}/statuses
GET /repos/{owner}/{repo}/compare/{basehead}
POST /repos/{owner}/{repo}/statuses/{sha}
copilot
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest
GET /enterprises/{enterprise}/copilot/metrics/reports/repos-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/user-teams-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/users-1-day
GET /enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest
GET /orgs/{org}/copilot/billing
GET /orgs/{org}/copilot/billing/seats
POST /orgs/{org}/copilot/billing/selected_teams
DELETE /orgs/{org}/copilot/billing/selected_teams
POST /orgs/{org}/copilot/billing/selected_users
DELETE /orgs/{org}/copilot/billing/selected_users
GET /orgs/{org}/copilot/coding-agent/permissions
PUT /orgs/{org}/copilot/coding-agent/permissions
GET /orgs/{org}/copilot/coding-agent/permissions/repositories
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}
DELETE /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}
GET /orgs/{org}/copilot/content_exclusion
PUT /orgs/{org}/copilot/content_exclusion
GET /orgs/{org}/copilot/metrics/reports/organization-1-day
GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest
GET /orgs/{org}/copilot/metrics/reports/repos-1-day
GET /orgs/{org}/copilot/metrics/reports/user-teams-1-day
GET /orgs/{org}/copilot/metrics/reports/users-1-day
GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest
GET /orgs/{org}/members/{username}/copilot
GET /repos/{owner}/{repo}/copilot/cloud-agent/configuration
copilot-spaces
GET /orgs/{org}/copilot-spaces
POST /orgs/{org}/copilot-spaces
GET /orgs/{org}/copilot-spaces/{space_number}
PUT /orgs/{org}/copilot-spaces/{space_number}
DELETE /orgs/{org}/copilot-spaces/{space_number}
GET /orgs/{org}/copilot-spaces/{space_number}/collaborators
POST /orgs/{org}/copilot-spaces/{space_number}/collaborators
PUT /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}
DELETE /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}
GET /orgs/{org}/copilot-spaces/{space_number}/resources
POST /orgs/{org}/copilot-spaces/{space_number}/resources
GET /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
PUT /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
DELETE /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}
dependabot
GET /enterprises/{enterprise}/dependabot/repository-access
PATCH /enterprises/{enterprise}/dependabot/repository-access
PUT /enterprises/{enterprise}/dependabot/repository-access/default-level
GET /orgs/{org}/dependabot/alerts
GET /orgs/{org}/dependabot/repository-access
PATCH /orgs/{org}/dependabot/repository-access
PUT /orgs/{org}/dependabot/repository-access/default-level
GET /orgs/{org}/dependabot/secrets
GET /orgs/{org}/dependabot/secrets/public-key
GET /orgs/{org}/dependabot/secrets/{secret_name}
PUT /orgs/{org}/dependabot/secrets/{secret_name}
DELETE /orgs/{org}/dependabot/secrets/{secret_name}
GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}
GET /repos/{owner}/{repo}/dependabot/alerts
GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}
GET /repos/{owner}/{repo}/dependabot/secrets
GET /repos/{owner}/{repo}/dependabot/secrets/public-key
GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}
dependency-graph
GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}
GET /repos/{owner}/{repo}/dependency-graph/sbom
GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{sbom_uuid}
GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report
POST /repos/{owner}/{repo}/dependency-graph/snapshots
deploy-keys
GET /repos/{owner}/{repo}/keys
POST /repos/{owner}/{repo}/keys
GET /repos/{owner}/{repo}/keys/{key_id}
DELETE /repos/{owner}/{repo}/keys/{key_id}
deployments
GET /repos/{owner}/{repo}/deployments
POST /repos/{owner}/{repo}/deployments
GET /repos/{owner}/{repo}/deployments/{deployment_id}
DELETE /repos/{owner}/{repo}/deployments/{deployment_id}
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}
GET /repos/{owner}/{repo}/environments
GET /repos/{owner}/{repo}/environments/{environment_name}
PUT /repos/{owner}/{repo}/environments/{environment_name}
DELETE /repos/{owner}/{repo}/environments/{environment_name}
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}
emojis
GET /emojis
gists
GET /gists
POST /gists
GET /gists/public
GET /gists/starred
GET /gists/{gist_id}
PATCH /gists/{gist_id}
DELETE /gists/{gist_id}
GET /gists/{gist_id}/comments
POST /gists/{gist_id}/comments
GET /gists/{gist_id}/comments/{comment_id}
PATCH /gists/{gist_id}/comments/{comment_id}
DELETE /gists/{gist_id}/comments/{comment_id}
GET /gists/{gist_id}/commits
GET /gists/{gist_id}/forks
POST /gists/{gist_id}/forks
GET /gists/{gist_id}/star
PUT /gists/{gist_id}/star
DELETE /gists/{gist_id}/star
GET /gists/{gist_id}/{sha}
GET /users/{username}/gists
git
POST /repos/{owner}/{repo}/git/blobs
GET /repos/{owner}/{repo}/git/blobs/{file_sha}
POST /repos/{owner}/{repo}/git/commits
GET /repos/{owner}/{repo}/git/commits/{commit_sha}
GET /repos/{owner}/{repo}/git/matching-refs/{ref}
GET /repos/{owner}/{repo}/git/ref/{ref}
POST /repos/{owner}/{repo}/git/refs
PATCH /repos/{owner}/{repo}/git/refs/{ref}
DELETE /repos/{owner}/{repo}/git/refs/{ref}
POST /repos/{owner}/{repo}/git/tags
GET /repos/{owner}/{repo}/git/tags/{tag_sha}
POST /repos/{owner}/{repo}/git/trees
GET /repos/{owner}/{repo}/git/trees/{tree_sha}
gitignore
GET /gitignore/templates
GET /gitignore/templates/{name}
interactions
GET /orgs/{org}/interaction-limits
PUT /orgs/{org}/interaction-limits
DELETE /orgs/{org}/interaction-limits
GET /orgs/{org}/interaction-limits/pulls/creation-cap
PATCH /orgs/{org}/interaction-limits/pulls/creation-cap
GET /repos/{owner}/{repo}/interaction-limits
PUT /repos/{owner}/{repo}/interaction-limits
DELETE /repos/{owner}/{repo}/interaction-limits
GET /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
PUT /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
DELETE /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list
GET /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap
PATCH /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap
GET /user/interaction-limits
PUT /user/interaction-limits
DELETE /user/interaction-limits
issues
GET /issues
GET /orgs/{org}/issues
GET /repos/{owner}/{repo}/assignees
GET /repos/{owner}/{repo}/assignees/{assignee}
GET /repos/{owner}/{repo}/issues
POST /repos/{owner}/{repo}/issues
GET /repos/{owner}/{repo}/issues/comments
GET /repos/{owner}/{repo}/issues/comments/{comment_id}
PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}
PUT /repos/{owner}/{repo}/issues/comments/{comment_id}/pin
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/pin
GET /repos/{owner}/{repo}/issues/events
GET /repos/{owner}/{repo}/issues/events/{event_id}
GET /repos/{owner}/{repo}/issues/{issue_number}
PATCH /repos/{owner}/{repo}/issues/{issue_number}
POST /repos/{owner}/{repo}/issues/{issue_number}/assignees
DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees
GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}
GET /repos/{owner}/{repo}/issues/{issue_number}/comments
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking
GET /repos/{owner}/{repo}/issues/{issue_number}/events
GET /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
POST /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
PUT /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values
DELETE /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values/{issue_field_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/labels
POST /repos/{owner}/{repo}/issues/{issue_number}/labels
PUT /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}
PUT /repos/{owner}/{repo}/issues/{issue_number}/lock
DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock
GET /repos/{owner}/{repo}/issues/{issue_number}/parent
GET /repos/{owner}/{repo}/issues/{issue_number}/relates_to
POST /repos/{owner}/{repo}/issues/{issue_number}/relates_to
DELETE /repos/{owner}/{repo}/issues/{issue_number}/relates_to/{issue_id}
DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue
GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority
GET /repos/{owner}/{repo}/issues/{issue_number}/suggestions
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/approve
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/dismiss
GET /repos/{owner}/{repo}/issues/{issue_number}/timeline
GET /repos/{owner}/{repo}/labels
POST /repos/{owner}/{repo}/labels
GET /repos/{owner}/{repo}/labels/{name}
PATCH /repos/{owner}/{repo}/labels/{name}
DELETE /repos/{owner}/{repo}/labels/{name}
GET /repos/{owner}/{repo}/milestones
POST /repos/{owner}/{repo}/milestones
GET /repos/{owner}/{repo}/milestones/{milestone_number}
PATCH /repos/{owner}/{repo}/milestones/{milestone_number}
DELETE /repos/{owner}/{repo}/milestones/{milestone_number}
GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels
GET /user/issues
licenses
GET /licenses
GET /licenses/{license}
GET /repos/{owner}/{repo}/license
markdown
POST /markdown
POST /markdown/raw
meta
GET /
GET /meta
GET /octocat
GET /versions
GET /zen
metrics
GET /repos/{owner}/{repo}/community/profile
GET /repos/{owner}/{repo}/stats/code_frequency
GET /repos/{owner}/{repo}/stats/commit_activity
GET /repos/{owner}/{repo}/stats/contributors
GET /repos/{owner}/{repo}/stats/participation
GET /repos/{owner}/{repo}/stats/punch_card
GET /repos/{owner}/{repo}/traffic/clones
GET /repos/{owner}/{repo}/traffic/popular/paths
GET /repos/{owner}/{repo}/traffic/popular/referrers
GET /repos/{owner}/{repo}/traffic/views
migrations
GET /repos/{owner}/{repo}/import
PUT /repos/{owner}/{repo}/import
PATCH /repos/{owner}/{repo}/import
DELETE /repos/{owner}/{repo}/import
GET /repos/{owner}/{repo}/import/authors
PATCH /repos/{owner}/{repo}/import/authors/{author_id}
GET /repos/{owner}/{repo}/import/large_files
PATCH /repos/{owner}/{repo}/import/lfs
orgs
GET /organizations
GET /orgs/{org}
PATCH /orgs/{org}
DELETE /orgs/{org}
POST /orgs/{org}/artifacts/metadata/deployment-record
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs
GET /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs/{job_id}
POST /orgs/{org}/artifacts/metadata/storage-record
GET /orgs/{org}/artifacts/{subject_digest}/metadata/deployment-records
GET /orgs/{org}/artifacts/{subject_digest}/metadata/storage-records
POST /orgs/{org}/attestations/bulk-list
POST /orgs/{org}/attestations/delete-request
DELETE /orgs/{org}/attestations/digest/{subject_digest}
GET /orgs/{org}/attestations/repositories
DELETE /orgs/{org}/attestations/{attestation_id}
GET /orgs/{org}/attestations/{subject_digest}
GET /orgs/{org}/blocks
GET /orgs/{org}/blocks/{username}
PUT /orgs/{org}/blocks/{username}
DELETE /orgs/{org}/blocks/{username}
GET /orgs/{org}/failed_invitations
GET /orgs/{org}/hooks
POST /orgs/{org}/hooks
GET /orgs/{org}/hooks/{hook_id}
PATCH /orgs/{org}/hooks/{hook_id}
DELETE /orgs/{org}/hooks/{hook_id}
GET /orgs/{org}/hooks/{hook_id}/config
PATCH /orgs/{org}/hooks/{hook_id}/config
GET /orgs/{org}/hooks/{hook_id}/deliveries
GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}
POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts
POST /orgs/{org}/hooks/{hook_id}/pings
GET /orgs/{org}/insights/api/route-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/subject-stats
GET /orgs/{org}/insights/api/summary-stats
GET /orgs/{org}/insights/api/summary-stats/users/{user_id}
GET /orgs/{org}/insights/api/summary-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/time-stats
GET /orgs/{org}/insights/api/time-stats/users/{user_id}
GET /orgs/{org}/insights/api/time-stats/{actor_type}/{actor_id}
GET /orgs/{org}/insights/api/user-stats/{user_id}
GET /orgs/{org}/installations
GET /orgs/{org}/invitations
POST /orgs/{org}/invitations
DELETE /orgs/{org}/invitations/{invitation_id}
GET /orgs/{org}/invitations/{invitation_id}/teams
GET /orgs/{org}/issue-fields
POST /orgs/{org}/issue-fields
PATCH /orgs/{org}/issue-fields/{issue_field_id}
DELETE /orgs/{org}/issue-fields/{issue_field_id}
GET /orgs/{org}/issue-types
POST /orgs/{org}/issue-types
PUT /orgs/{org}/issue-types/{issue_type_id}
DELETE /orgs/{org}/issue-types/{issue_type_id}
GET /orgs/{org}/members
GET /orgs/{org}/members/{username}
DELETE /orgs/{org}/members/{username}
GET /orgs/{org}/memberships/{username}
PUT /orgs/{org}/memberships/{username}
DELETE /orgs/{org}/memberships/{username}
GET /orgs/{org}/organization-roles
DELETE /orgs/{org}/organization-roles/teams/{team_slug}
PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}
DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}
DELETE /orgs/{org}/organization-roles/users/{username}
PUT /orgs/{org}/organization-roles/users/{username}/{role_id}
DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}
GET /orgs/{org}/organization-roles/{role_id}
GET /orgs/{org}/organization-roles/{role_id}/teams
GET /orgs/{org}/organization-roles/{role_id}/users
GET /orgs/{org}/outside_collaborators
PUT /orgs/{org}/outside_collaborators/{username}
DELETE /orgs/{org}/outside_collaborators/{username}
GET /orgs/{org}/personal-access-token-requests
POST /orgs/{org}/personal-access-token-requests
POST /orgs/{org}/personal-access-token-requests/{pat_request_id}
GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories
GET /orgs/{org}/personal-access-tokens
POST /orgs/{org}/personal-access-tokens
POST /orgs/{org}/personal-access-tokens/{pat_id}
GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories
GET /orgs/{org}/properties/installations
POST /orgs/{org}/properties/installations
GET /orgs/{org}/properties/schema
PATCH /orgs/{org}/properties/schema
GET /orgs/{org}/properties/schema/{custom_property_name}
PUT /orgs/{org}/properties/schema/{custom_property_name}
DELETE /orgs/{org}/properties/schema/{custom_property_name}
GET /orgs/{org}/properties/values
PATCH /orgs/{org}/properties/values
GET /orgs/{org}/public_members
GET /orgs/{org}/public_members/{username}
PUT /orgs/{org}/public_members/{username}
DELETE /orgs/{org}/public_members/{username}
GET /orgs/{org}/rulesets
POST /orgs/{org}/rulesets
GET /orgs/{org}/rulesets/rule-suites
GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}
GET /orgs/{org}/rulesets/{ruleset_id}
PUT /orgs/{org}/rulesets/{ruleset_id}
DELETE /orgs/{org}/rulesets/{ruleset_id}
GET /orgs/{org}/rulesets/{ruleset_id}/history
GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}
GET /orgs/{org}/security-managers
PUT /orgs/{org}/security-managers/teams/{team_slug}
DELETE /orgs/{org}/security-managers/teams/{team_slug}
GET /orgs/{org}/settings/immutable-releases
PUT /orgs/{org}/settings/immutable-releases
GET /orgs/{org}/settings/immutable-releases/repositories
PUT /orgs/{org}/settings/immutable-releases/repositories
PUT /orgs/{org}/settings/immutable-releases/repositories/{repository_id}
DELETE /orgs/{org}/settings/immutable-releases/repositories/{repository_id}
GET /orgs/{org}/settings/network-configurations
POST /orgs/{org}/settings/network-configurations
GET /orgs/{org}/settings/network-configurations/{network_configuration_id}
PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}
DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}
GET /orgs/{org}/settings/network-settings/{network_settings_id}
POST /orgs/{org}/{security_product}/{enablement}
GET /user/memberships/orgs
GET /user/memberships/orgs/{org}
PATCH /user/memberships/orgs/{org}
GET /user/orgs
GET /users/{username}/orgs
packages
GET /orgs/{org}/docker/conflicts
GET /orgs/{org}/packages
GET /orgs/{org}/packages/{package_type}/{package_name}
DELETE /orgs/{org}/packages/{package_type}/{package_name}
GET /orgs/{org}/packages/{package_type}/{package_name}/versions
GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}
GET /user/docker/conflicts
GET /user/packages
GET /user/packages/{package_type}/{package_name}
DELETE /user/packages/{package_type}/{package_name}
GET /user/packages/{package_type}/{package_name}/versions
GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}
GET /users/{username}/docker/conflicts
GET /users/{username}/packages
GET /users/{username}/packages/{package_type}/{package_name}
DELETE /users/{username}/packages/{package_type}/{package_name}
GET /users/{username}/packages/{package_type}/{package_name}/versions
GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}
pages
GET /repos/{owner}/{repo}/pages
POST /repos/{owner}/{repo}/pages
PUT /repos/{owner}/{repo}/pages
DELETE /repos/{owner}/{repo}/pages
GET /repos/{owner}/{repo}/pages/builds
POST /repos/{owner}/{repo}/pages/builds
GET /repos/{owner}/{repo}/pages/builds/latest
GET /repos/{owner}/{repo}/pages/builds/{build_id}
POST /repos/{owner}/{repo}/pages/deployments
GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}
POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel
GET /repos/{owner}/{repo}/pages/health
private-registries
GET /orgs/{org}/private-registries
POST /orgs/{org}/private-registries
GET /orgs/{org}/private-registries/public-key
GET /orgs/{org}/private-registries/{secret_name}
PATCH /orgs/{org}/private-registries/{secret_name}
DELETE /orgs/{org}/private-registries/{secret_name}
projects
GET /orgs/{org}/projectsV2
GET /orgs/{org}/projectsV2/{project_number}
POST /orgs/{org}/projectsV2/{project_number}/drafts
GET /orgs/{org}/projectsV2/{project_number}/fields
POST /orgs/{org}/projectsV2/{project_number}/fields
GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}
GET /orgs/{org}/projectsV2/{project_number}/items
POST /orgs/{org}/projectsV2/{project_number}/items
GET /orgs/{org}/projectsV2/{project_number}/items/{item_id}
PATCH /orgs/{org}/projectsV2/{project_number}/items/{item_id}
DELETE /orgs/{org}/projectsV2/{project_number}/items/{item_id}
POST /orgs/{org}/projectsV2/{project_number}/views
GET /orgs/{org}/projectsV2/{project_number}/views/{view_number}/items
pulls
GET /repos/{owner}/{repo}/pulls
POST /repos/{owner}/{repo}/pulls
GET /repos/{owner}/{repo}/pulls/comments
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}
PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}
GET /repos/{owner}/{repo}/pulls/{pull_number}
PATCH /repos/{owner}/{repo}/pulls/{pull_number}
GET /repos/{owner}/{repo}/pulls/{pull_number}/comments
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies
GET /repos/{owner}/{repo}/pulls/{pull_number}/commits
GET /repos/{owner}/{repo}/pulls/{pull_number}/files
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}
GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers/rerequest
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events
PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch
GET /repos/{owner}/{repo}/stacks
POST /repos/{owner}/{repo}/stacks
GET /repos/{owner}/{repo}/stacks/{stack_number}
POST /repos/{owner}/{repo}/stacks/{stack_number}/add
POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack
rate-limit
GET /rate_limit
reactions
GET /repos/{owner}/{repo}/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/issues/{issue_number}/reactions
POST /repos/{owner}/{repo}/issues/{issue_number}/reactions
DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}
GET /repos/{owner}/{repo}/releases/{release_id}/reactions
POST /repos/{owner}/{repo}/releases/{release_id}/reactions
DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}
releases
GET /repos/{owner}/{repo}/releases
POST /repos/{owner}/{repo}/releases
GET /repos/{owner}/{repo}/releases/assets/{asset_id}
PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}
DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}
POST /repos/{owner}/{repo}/releases/generate-notes
GET /repos/{owner}/{repo}/releases/latest
GET /repos/{owner}/{repo}/releases/tags/{tag}
GET /repos/{owner}/{repo}/releases/{release_id}
PATCH /repos/{owner}/{repo}/releases/{release_id}
DELETE /repos/{owner}/{repo}/releases/{release_id}
GET /repos/{owner}/{repo}/releases/{release_id}/assets
repos
GET /orgs/{org}/repos
POST /orgs/{org}/repos
GET /repos/{owner}/{repo}
PATCH /repos/{owner}/{repo}
DELETE /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/activity
POST /repos/{owner}/{repo}/attestations
GET /repos/{owner}/{repo}/attestations/{subject_digest}
GET /repos/{owner}/{repo}/autolinks
POST /repos/{owner}/{repo}/autolinks
GET /repos/{owner}/{repo}/autolinks/{autolink_id}
DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}
GET /repos/{owner}/{repo}/automated-security-fixes
PUT /repos/{owner}/{repo}/automated-security-fixes
DELETE /repos/{owner}/{repo}/automated-security-fixes
GET /repos/{owner}/{repo}/codeowners/errors
GET /repos/{owner}/{repo}/contents/{path}
PUT /repos/{owner}/{repo}/contents/{path}
DELETE /repos/{owner}/{repo}/contents/{path}
GET /repos/{owner}/{repo}/contributors
POST /repos/{owner}/{repo}/dispatches
GET /repos/{owner}/{repo}/forks
POST /repos/{owner}/{repo}/forks
GET /repos/{owner}/{repo}/hash-algorithm
GET /repos/{owner}/{repo}/hooks
POST /repos/{owner}/{repo}/hooks
GET /repos/{owner}/{repo}/hooks/{hook_id}
PATCH /repos/{owner}/{repo}/hooks/{hook_id}
DELETE /repos/{owner}/{repo}/hooks/{hook_id}
GET /repos/{owner}/{repo}/hooks/{hook_id}/config
PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}
POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts
POST /repos/{owner}/{repo}/hooks/{hook_id}/pings
POST /repos/{owner}/{repo}/hooks/{hook_id}/tests
GET /repos/{owner}/{repo}/immutable-releases
PUT /repos/{owner}/{repo}/immutable-releases
DELETE /repos/{owner}/{repo}/immutable-releases
GET /repos/{owner}/{repo}/issue-types
GET /repos/{owner}/{repo}/languages
GET /repos/{owner}/{repo}/private-vulnerability-reporting
PUT /repos/{owner}/{repo}/private-vulnerability-reporting
DELETE /repos/{owner}/{repo}/private-vulnerability-reporting
GET /repos/{owner}/{repo}/properties/values
PATCH /repos/{owner}/{repo}/properties/values
GET /repos/{owner}/{repo}/readme
GET /repos/{owner}/{repo}/readme/{dir}
GET /repos/{owner}/{repo}/rules/branches/{branch}
GET /repos/{owner}/{repo}/rulesets
POST /repos/{owner}/{repo}/rulesets
GET /repos/{owner}/{repo}/rulesets/rule-suites
GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}
PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}
DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}
GET /repos/{owner}/{repo}/tags
GET /repos/{owner}/{repo}/tarball/{ref}
GET /repos/{owner}/{repo}/teams
GET /repos/{owner}/{repo}/topics
PUT /repos/{owner}/{repo}/topics
POST /repos/{owner}/{repo}/transfer
GET /repos/{owner}/{repo}/vulnerability-alerts
PUT /repos/{owner}/{repo}/vulnerability-alerts
DELETE /repos/{owner}/{repo}/vulnerability-alerts
GET /repos/{owner}/{repo}/zipball/{ref}
POST /repos/{template_owner}/{template_repo}/generate
GET /repositories
GET /user/repos
POST /user/repos
GET /users/{username}/repos
search
GET /search/code
GET /search/commits
GET /search/issues
GET /search/labels
GET /search/repositories
GET /search/topics
GET /search/users
secret-scanning
GET /orgs/{org}/secret-scanning/alerts
GET /orgs/{org}/secret-scanning/custom-patterns
POST /orgs/{org}/secret-scanning/custom-patterns
DELETE /orgs/{org}/secret-scanning/custom-patterns
PATCH /orgs/{org}/secret-scanning/custom-patterns/{pattern_id}
GET /orgs/{org}/secret-scanning/pattern-configurations
PATCH /orgs/{org}/secret-scanning/pattern-configurations
GET /repos/{owner}/{repo}/secret-scanning/alerts
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations
GET /repos/{owner}/{repo}/secret-scanning/custom-patterns
POST /repos/{owner}/{repo}/secret-scanning/custom-patterns
DELETE /repos/{owner}/{repo}/secret-scanning/custom-patterns
PATCH /repos/{owner}/{repo}/secret-scanning/custom-patterns/{pattern_id}
POST /repos/{owner}/{repo}/secret-scanning/push-protection-bypasses
GET /repos/{owner}/{repo}/secret-scanning/scan-history
security-advisories
GET /advisories
GET /advisories/{ghsa_id}
GET /orgs/{org}/security-advisories
GET /repos/{owner}/{repo}/security-advisories
POST /repos/{owner}/{repo}/security-advisories
POST /repos/{owner}/{repo}/security-advisories/reports
GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}
PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks
teams
GET /orgs/{org}/teams
POST /orgs/{org}/teams
GET /orgs/{org}/teams/{team_slug}
PATCH /orgs/{org}/teams/{team_slug}
DELETE /orgs/{org}/teams/{team_slug}
GET /orgs/{org}/teams/{team_slug}/invitations
GET /orgs/{org}/teams/{team_slug}/members
GET /orgs/{org}/teams/{team_slug}/memberships/{username}
PUT /orgs/{org}/teams/{team_slug}/memberships/{username}
DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}
GET /orgs/{org}/teams/{team_slug}/repos
GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}
GET /orgs/{org}/teams/{team_slug}/teams
GET /teams/{team_id}
PATCH /teams/{team_id}
DELETE /teams/{team_id}
GET /teams/{team_id}/invitations
GET /teams/{team_id}/members
GET /teams/{team_id}/members/{username}
PUT /teams/{team_id}/members/{username}
DELETE /teams/{team_id}/members/{username}
GET /teams/{team_id}/memberships/{username}
PUT /teams/{team_id}/memberships/{username}
DELETE /teams/{team_id}/memberships/{username}
GET /teams/{team_id}/repos
GET /teams/{team_id}/repos/{owner}/{repo}
PUT /teams/{team_id}/repos/{owner}/{repo}
DELETE /teams/{team_id}/repos/{owner}/{repo}
GET /teams/{team_id}/teams
GET /user/teams
users
GET /user
PATCH /user
GET /user/blocks
GET /user/blocks/{username}
PUT /user/blocks/{username}
DELETE /user/blocks/{username}
PATCH /user/email/visibility
GET /user/emails
POST /user/emails
DELETE /user/emails
GET /user/followers
GET /user/following
GET /user/following/{username}
PUT /user/following/{username}
DELETE /user/following/{username}
GET /user/gpg_keys
POST /user/gpg_keys
GET /user/gpg_keys/{gpg_key_id}
DELETE /user/gpg_keys/{gpg_key_id}
GET /user/keys
POST /user/keys
GET /user/keys/{key_id}
DELETE /user/keys/{key_id}
GET /user/public_emails
GET /user/social_accounts
POST /user/social_accounts
DELETE /user/social_accounts
GET /user/ssh_signing_keys
POST /user/ssh_signing_keys
GET /user/ssh_signing_keys/{ssh_signing_key_id}
DELETE /user/ssh_signing_keys/{ssh_signing_key_id}
GET /user/{account_id}
GET /users
GET /users/{username}
POST /users/{username}/attestations/bulk-list
POST /users/{username}/attestations/delete-request
DELETE /users/{username}/attestations/digest/{subject_digest}
DELETE /users/{username}/attestations/{attestation_id}
GET /users/{username}/attestations/{subject_digest}
GET /users/{username}/followers
GET /users/{username}/following
GET /users/{username}/following/{target_user}
GET /users/{username}/gpg_keys
GET /users/{username}/keys
GET /users/{username}/social_accounts
GET /users/{username}/ssh_signing_keys

Back to top
Help and support
Was this Doc helpful?

Help us make GitHub Docs great!
All Docs are open source. See something that's wrong or unclear? Submit a pull request.

Still need help?
Ask the GitHub community
Contact support
Expert services
Blog
GitHub Inc. © 2026
Terms
Privacy
Status
Pricing

Endpoints available for GitHub App user access tokens - GitHub Docs
Copied! 

Skip to main content
GitHub Docs
Select your plan:

Search or ask Copilot
/

HomeREST APIAuthenticationPermissions for GitHub Apps
REST API
Quickstart

About the REST API

Using the REST API

Authentication
Authenticating
Keeping API credentials secure
Endpoints for GitHub App installation tokens
Endpoints for GitHub App user tokens
Endpoints for fine-grained PATs
Permissions for GitHub Apps
Permissions for fine-grained PATs

Guides

Actions

Activity

Agent tasks

Agents

Apps

Billing

Branches

Campaigns

Checks

Classroom

Code quality

Code scanning

Code security settings

Codes of conduct

Codespaces

Collaborators

Commits

Copilot

Copilot Spaces

Credentials

Dependabot

Dependency graph

Deploy keys

Deployments

Emojis

Gists

Git database

Gitignore

Interactions

Issues

Licenses

Markdown

Meta

Metrics

Migrations

Organizations

Packages

Pages

Private registries

Projects

Pull requests

Rate limit

Reactions

Releases

Repositories

Search

Secret scanning

Security advisories

Teams

Users
Permissions required for GitHub Apps
For each permission granted to a GitHub App, these are the REST API endpoints that the app can use.

In this article
About GitHub App permissions
Enterprise permissions for "Enterprise Copilot metrics"
Organization permissions for "API Insights"
Organization permissions for "Administration"
Organization permissions for "Agent secrets"
Organization permissions for "Agent variables"
Organization permissions for "Blocking users"
Organization permissions for "Campaigns"
Organization permissions for "Copilot Spaces"
Organization permissions for "Copilot agent settings"
Organization permissions for "Copilot content exclusion"
Organization permissions for "Custom organization roles"
Organization permissions for "Custom properties"
Organization permissions for "Events"
Organization permissions for "External custom properties for repositories"
Organization permissions for "GitHub Copilot Business"
Organization permissions for "Hosted runner custom images"
Organization permissions for "Issue Fields"
Organization permissions for "Issue Types"
Organization permissions for "Members"
Organization permissions for "Network configurations"
Organization permissions for "Organization Copilot metrics"
Organization permissions for "Organization codespaces secrets"
Organization permissions for "Organization codespaces settings"
Organization permissions for "Organization codespaces"
Organization permissions for "Organization dependabot secrets"
Organization permissions for "Organization private registries"
Organization permissions for "Personal access token requests"
Organization permissions for "Personal access tokens"
Organization permissions for "Projects"
Organization permissions for "Secrets"
Organization permissions for "Self-hosted runners"
Organization permissions for "Variables"
Organization permissions for "Webhooks"
Repository permissions for "Actions"
Repository permissions for "Administration"
Repository permissions for "Agent secrets"
Repository permissions for "Agent variables"
Repository permissions for "Artifact metadata"
Repository permissions for "Attestations"
Repository permissions for "Checks"
Repository permissions for "Code quality"
Repository permissions for "Code scanning alerts"
Repository permissions for "Codespaces lifecycle admin"
Repository permissions for "Codespaces metadata"
Repository permissions for "Codespaces secrets"
Repository permissions for "Codespaces"
Repository permissions for "Commit statuses"
Repository permissions for "Contents"
Repository permissions for "Copilot agent settings"
Repository permissions for "Custom properties"
Repository permissions for "Dependabot alerts"
Repository permissions for "Dependabot secrets"
Repository permissions for "Deployments"
Repository permissions for "Environments"
Repository permissions for "GitHub App installation repository access"
Repository permissions for "Issues"
Repository permissions for "Metadata"
Repository permissions for "Pages"
Repository permissions for "Pull requests"
Repository permissions for "Repository creation"
Repository permissions for "Repository security advisories"
Repository permissions for "Secret scanning alerts"
Repository permissions for "Secrets"
Repository permissions for "Variables"
Repository permissions for "Webhooks"
Repository permissions for "Workflows"
User permissions for "Block another user"
User permissions for "Codespaces user secrets"
User permissions for "Email addresses"
User permissions for "Followers"
User permissions for "GPG keys"
User permissions for "Gists"
User permissions for "Git SSH keys"
User permissions for "Interaction limits"
User permissions for "Plan"
User permissions for "Private repository invitations"
User permissions for "Profile"
User permissions for "SSH signing keys"
User permissions for "Starring"
User permissions for "Watching"
About GitHub App permissions
GitHub Apps are created with a set of permissions. Permissions define what resources the GitHub App can access via the API. For more information, see Choosing permissions for a GitHub App.

To help you choose the correct permissions, you will receive the X-Accepted-GitHub-Permissions header in the REST API response. The header will tell you what permissions are required in order to access the endpoint. For more information, see Troubleshooting the REST API.

These permissions are required to access private resources. Some endpoints can also be used to access public resources without these permissions. To see whether an endpoint can access public resources without a permission, see the documentation for that endpoint.

Some endpoints require more than one permission. Other endpoints work with any one permission from a set of permissions. In these cases, the "Additional permissions" column will include a checkmark. For full details about the permissions that are required to use the endpoint, see the documentation for that endpoint.

Enterprise permissions for "Enterprise Copilot metrics"
Endpoint	Access	Token types	Additional permissions
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day	read	UAT
IAT	
GET /enterprises/{enterprise}/copilot/metrics/reports/enterprise-28-day/latest	read	UAT
IAT	
GET /enterprises/{enterprise}/copilot/metrics/reports/repos-1-day	read	UAT
IAT	
GET /enterprises/{enterprise}/copilot/metrics/reports/user-teams-1-day	read	UAT
IAT	
GET /enterprises/{enterprise}/copilot/metrics/reports/users-1-day	read	UAT
IAT	
GET /enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest	read	UAT
IAT	
Organization permissions for "API Insights"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/insights/api/route-stats/{actor_type}/{actor_id}	read	UAT
IAT	
GET /orgs/{org}/insights/api/subject-stats	read	UAT
IAT	
GET /orgs/{org}/insights/api/summary-stats	read	UAT
IAT	
GET /orgs/{org}/insights/api/summary-stats/users/{user_id}	read	UAT
IAT	
GET /orgs/{org}/insights/api/summary-stats/{actor_type}/{actor_id}	read	UAT
IAT	
GET /orgs/{org}/insights/api/time-stats	read	UAT
IAT	
GET /orgs/{org}/insights/api/time-stats/users/{user_id}	read	UAT
IAT	
GET /orgs/{org}/insights/api/time-stats/{actor_type}/{actor_id}	read	UAT
IAT	
GET /orgs/{org}/insights/api/user-stats/{user_id}	read	UAT
IAT	
Organization permissions for "Administration"
Endpoint	Access	Token types	Additional permissions
PUT /organizations/{org}/actions/cache/retention-limit	write	UAT
IAT	
PUT /organizations/{org}/actions/cache/storage-limit	write	UAT
IAT	
POST /organizations/{org}/settings/billing/budgets	write	UAT
IAT	
PATCH /organizations/{org}/settings/billing/budgets/{budget_id}	write	UAT
IAT	
DELETE /organizations/{org}/settings/billing/budgets/{budget_id}	write	UAT
IAT	
PATCH /orgs/{org}	write	UAT
IAT	
DELETE /orgs/{org}	write	UAT
IAT	
POST /orgs/{org}/actions/hosted-runners	write	UAT
IAT	
PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}	write	UAT
IAT	
DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}	write	UAT
IAT	
POST /orgs/{org}/actions/oidc/customization/properties/repo	write	UAT
IAT	
DELETE /orgs/{org}/actions/oidc/customization/properties/repo/{custom_property_name}	write	UAT
IAT	
PUT /orgs/{org}/actions/oidc/customization/sub	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/artifact-and-log-retention	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/fork-pr-contributor-approval	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/repositories	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/actions/permissions/selected-actions	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/self-hosted-runners	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories	write	UAT
IAT	
PUT /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/actions/permissions/self-hosted-runners/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/actions/permissions/workflow	write	UAT
IAT	
GET /orgs/{org}/actions/policies	write	UAT
IAT	
POST /orgs/{org}/actions/policies	write	UAT
IAT	
GET /orgs/{org}/actions/policies/{policy_id}	write	UAT
IAT	
PUT /orgs/{org}/actions/policies/{policy_id}	write	UAT
IAT	
DELETE /orgs/{org}/actions/policies/{policy_id}	write	UAT
IAT	
PATCH /orgs/{org}/code-scanning/ai-scan	write	UAT
IAT	
POST /orgs/{org}/code-security/configurations	write	UAT
IAT	
DELETE /orgs/{org}/code-security/configurations/detach	write	UAT
IAT	
PATCH /orgs/{org}/code-security/configurations/{configuration_id}	write	UAT
IAT	
DELETE /orgs/{org}/code-security/configurations/{configuration_id}	write	UAT
IAT	
POST /orgs/{org}/code-security/configurations/{configuration_id}/attach	write	UAT
IAT	
PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults	write	UAT
IAT	
POST /orgs/{org}/copilot/billing/selected_teams	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/copilot/billing/selected_teams	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /orgs/{org}/copilot/billing/selected_users	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/copilot/billing/selected_users	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /orgs/{org}/dependabot/repository-access	write	UAT
IAT	
PUT /orgs/{org}/dependabot/repository-access/default-level	write	UAT
IAT	
PUT /orgs/{org}/interaction-limits	write	UAT
IAT	
DELETE /orgs/{org}/interaction-limits	write	UAT
IAT	
GET /orgs/{org}/interaction-limits/pulls/creation-cap	write	UAT
IAT	
PATCH /orgs/{org}/interaction-limits/pulls/creation-cap	write	UAT
IAT	
GET /orgs/{org}/rulesets	write	UAT
IAT	
POST /orgs/{org}/rulesets	write	UAT
IAT	
GET /orgs/{org}/rulesets/rule-suites	write	UAT
IAT	
GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}	write	UAT
IAT	
GET /orgs/{org}/rulesets/{ruleset_id}	write	UAT
IAT	
PUT /orgs/{org}/rulesets/{ruleset_id}	write	UAT
IAT	
DELETE /orgs/{org}/rulesets/{ruleset_id}	write	UAT
IAT	
GET /orgs/{org}/rulesets/{ruleset_id}/history	write	UAT
IAT	
GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}	write	UAT
IAT	
POST /orgs/{org}/secret-scanning/custom-patterns	write	UAT
IAT	
DELETE /orgs/{org}/secret-scanning/custom-patterns	write	UAT
IAT	
PATCH /orgs/{org}/secret-scanning/custom-patterns/{pattern_id}	write	UAT
IAT	
PATCH /orgs/{org}/secret-scanning/pattern-configurations	write	UAT
IAT	
PUT /orgs/{org}/security-managers/teams/{team_slug}	write	UAT
IAT	
DELETE /orgs/{org}/security-managers/teams/{team_slug}	write	UAT
IAT	
PUT /orgs/{org}/settings/immutable-releases	write	UAT
IAT	
PUT /orgs/{org}/settings/immutable-releases/repositories	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/settings/immutable-releases/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/settings/immutable-releases/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /orgs/{org}/{security_product}/{enablement}	write	UAT
IAT	
GET /organizations/{org}/actions/cache/retention-limit	read	UAT
IAT	
GET /organizations/{org}/actions/cache/storage-limit	read	UAT
IAT	
GET /organizations/{org}/settings/billing/ai_credit/usage	read	UAT
IAT	
GET /organizations/{org}/settings/billing/budgets	read	UAT
IAT	
GET /organizations/{org}/settings/billing/budgets/{budget_id}	read	UAT
IAT	
GET /organizations/{org}/settings/billing/premium_request/usage	read	UAT
IAT	
GET /organizations/{org}/settings/billing/usage	read	UAT
IAT	
GET /organizations/{org}/settings/billing/usage/summary	read	UAT
IAT	
GET /orgs/{org}/actions/cache/usage	read	UAT
IAT	
GET /orgs/{org}/actions/cache/usage-by-repository	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/github-owned	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/partner	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/limits	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/machine-sizes	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/platforms	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}	read	UAT
IAT	
GET /orgs/{org}/actions/oidc/customization/properties/repo	read	UAT
IAT	
GET /orgs/{org}/actions/oidc/customization/sub	read	UAT
IAT	
GET /orgs/{org}/actions/permissions	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/artifact-and-log-retention	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/fork-pr-contributor-approval	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/fork-pr-workflows-private-repos	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/repositories	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/selected-actions	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/self-hosted-runners	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/self-hosted-runners/repositories	read	UAT
IAT	
GET /orgs/{org}/actions/permissions/workflow	read	UAT
IAT	
GET /orgs/{org}/code-scanning/ai-scan	read	UAT
IAT	
GET /orgs/{org}/code-security/configurations	read	UAT
IAT	
GET /orgs/{org}/code-security/configurations/defaults	read	UAT
IAT	
GET /orgs/{org}/code-security/configurations/{configuration_id}	read	UAT
IAT	
GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories	read	UAT
IAT	
GET /orgs/{org}/copilot/billing	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/copilot/billing/seats	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/dependabot/repository-access	read	UAT
IAT	
GET /orgs/{org}/installations	read	UAT
IAT	
GET /orgs/{org}/interaction-limits	read	UAT
IAT	
GET /orgs/{org}/members/{username}/copilot	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/secret-scanning/custom-patterns	read	UAT
IAT	
GET /orgs/{org}/secret-scanning/pattern-configurations	read	UAT
IAT	
GET /orgs/{org}/security-managers	read	UAT
IAT	
GET /orgs/{org}/settings/immutable-releases	read	UAT
IAT	
GET /orgs/{org}/settings/immutable-releases/repositories	read	UAT
IAT	
Organization permissions for "Agent secrets"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/agents/secrets/{secret_name}	write	UAT
IAT	
DELETE /orgs/{org}/agents/secrets/{secret_name}	write	UAT
IAT	
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/agents/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/agents/secrets	read	UAT
IAT	
GET /orgs/{org}/agents/secrets/public-key	read	UAT
IAT	
GET /orgs/{org}/agents/secrets/{secret_name}	read	UAT
IAT	
GET /orgs/{org}/agents/secrets/{secret_name}/repositories	read	UAT
IAT	
Organization permissions for "Agent variables"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/agents/variables	write	UAT
IAT	
PATCH /orgs/{org}/agents/variables/{name}	write	UAT
IAT	
DELETE /orgs/{org}/agents/variables/{name}	write	UAT
IAT	
PUT /orgs/{org}/agents/variables/{name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/agents/variables/{name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/agents/variables/{name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/agents/variables	read	UAT
IAT	
GET /orgs/{org}/agents/variables/{name}	read	UAT
IAT	
GET /orgs/{org}/agents/variables/{name}/repositories	read	UAT
IAT	
Organization permissions for "Blocking users"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/blocks/{username}	write	UAT
IAT	
DELETE /orgs/{org}/blocks/{username}	write	UAT
IAT	
GET /orgs/{org}/blocks	read	UAT
IAT	
GET /orgs/{org}/blocks/{username}	read	UAT
IAT	
Organization permissions for "Campaigns"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/campaigns	write	UAT
IAT	
PATCH /orgs/{org}/campaigns/{campaign_number}	write	UAT
IAT	
DELETE /orgs/{org}/campaigns/{campaign_number}	write	UAT
IAT	
GET /orgs/{org}/campaigns	read	UAT
IAT	
GET /orgs/{org}/campaigns/{campaign_number}	read	UAT
IAT	
Organization permissions for "Copilot Spaces"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/copilot-spaces	write	UAT
IAT	
PUT /orgs/{org}/copilot-spaces/{space_number}	write	UAT
IAT	
DELETE /orgs/{org}/copilot-spaces/{space_number}	write	UAT
IAT	
POST /orgs/{org}/copilot-spaces/{space_number}/resources	write	UAT
IAT	
PUT /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}	write	UAT
IAT	
DELETE /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}	write	UAT
IAT	
GET /orgs/{org}/copilot-spaces	read	UAT
IAT	
GET /orgs/{org}/copilot-spaces/{space_number}	read	UAT
IAT	
GET /orgs/{org}/copilot-spaces/{space_number}/resources	read	UAT
IAT	
GET /orgs/{org}/copilot-spaces/{space_number}/resources/{space_resource_id}	read	UAT
IAT	
Organization permissions for "Copilot agent settings"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/copilot/coding-agent/permissions	write	UAT
IAT	
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories	write	UAT
IAT	
PUT /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/copilot/coding-agent/permissions/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/copilot/coding-agent/permissions	read	UAT
IAT	
GET /orgs/{org}/copilot/coding-agent/permissions/repositories	read	UAT
IAT	
Organization permissions for "Copilot content exclusion"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/copilot/content_exclusion	write	UAT
IAT	
GET /orgs/{org}/copilot/content_exclusion	read	UAT
IAT	
Organization permissions for "Custom organization roles"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/organization-roles	read	UAT
IAT	
GET /orgs/{org}/organization-roles/{role_id}	read	UAT
IAT	
Organization permissions for "Custom properties"
Endpoint	Access	Token types	Additional permissions
PATCH /orgs/{org}/properties/schema	admin	UAT
IAT	
PUT /orgs/{org}/properties/schema/{custom_property_name}	admin	UAT
IAT	
DELETE /orgs/{org}/properties/schema/{custom_property_name}	admin	UAT
IAT	
PATCH /orgs/{org}/properties/values	write	UAT
IAT	
GET /orgs/{org}/properties/schema	read	UAT
IAT	
GET /orgs/{org}/properties/schema/{custom_property_name}	read	UAT
IAT	
GET /orgs/{org}/properties/values	read	UAT
IAT	
Organization permissions for "Events"
Endpoint	Access	Token types	Additional permissions
GET /users/{username}/events/orgs/{org}	read	UAT
Organization permissions for "External custom properties for repositories"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/properties/installations	admin	UAT
IAT	
POST /orgs/{org}/properties/installations	admin	UAT
IAT	
PATCH /orgs/{org}/properties/installations/values	write	
IAT	
PATCH /orgs/{org}/properties/installations/values/{property_name}	write	
IAT	
DELETE /orgs/{org}/properties/installations/values/{property_name}	write	
IAT	
GET /orgs/{org}/properties/installations/schema	read	
IAT	
Organization permissions for "GitHub Copilot Business"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/copilot-spaces/{space_number}/collaborators	write	UAT
IAT	
PUT /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}	write	UAT
IAT	
DELETE /orgs/{org}/copilot-spaces/{space_number}/collaborators/{actor_type}/{actor_identifier}	write	UAT
IAT	
POST /orgs/{org}/copilot/billing/selected_teams	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/copilot/billing/selected_teams	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /orgs/{org}/copilot/billing/selected_users	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/copilot/billing/selected_users	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/copilot-spaces/{space_number}/collaborators	read	UAT
IAT	
GET /orgs/{org}/copilot/billing	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/copilot/billing/seats	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/members/{username}/copilot	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Organization permissions for "Hosted runner custom images"
Endpoint	Access	Token types	Additional permissions
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}	write	UAT
IAT	
DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}	write	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/custom	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions	read	UAT
IAT	
GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}	read	UAT
IAT	
Organization permissions for "Issue Fields"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/issue-fields	write	UAT
IAT	
PATCH /orgs/{org}/issue-fields/{issue_field_id}	write	UAT
IAT	
DELETE /orgs/{org}/issue-fields/{issue_field_id}	write	UAT
IAT	
GET /orgs/{org}/issue-fields	read	UAT
IAT	
Organization permissions for "Issue Types"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/issue-types	write	UAT
IAT	
PUT /orgs/{org}/issue-types/{issue_type_id}	write	UAT
IAT	
DELETE /orgs/{org}/issue-types/{issue_type_id}	write	UAT
IAT	
GET /orgs/{org}/issue-types	read	UAT
IAT	
Organization permissions for "Members"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/invitations	write	UAT
IAT	
DELETE /orgs/{org}/invitations/{invitation_id}	write	UAT
IAT	
DELETE /orgs/{org}/members/{username}	write	UAT
IAT	
PUT /orgs/{org}/memberships/{username}	write	UAT
IAT	
DELETE /orgs/{org}/memberships/{username}	write	UAT
IAT	
DELETE /orgs/{org}/organization-roles/teams/{team_slug}	write	UAT
IAT	
PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}	write	UAT
IAT	
DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}	write	UAT
IAT	
DELETE /orgs/{org}/organization-roles/users/{username}	write	UAT
IAT	
PUT /orgs/{org}/organization-roles/users/{username}/{role_id}	write	UAT
IAT	
DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}	write	UAT
IAT	
PUT /orgs/{org}/outside_collaborators/{username}	write	UAT
IAT	
DELETE /orgs/{org}/outside_collaborators/{username}	write	UAT
IAT	
PUT /orgs/{org}/public_members/{username}	write	UAT
DELETE /orgs/{org}/public_members/{username}	write	UAT
POST /orgs/{org}/teams	write	UAT
IAT	
PATCH /orgs/{org}/teams/{team_slug}	write	UAT
IAT	
DELETE /orgs/{org}/teams/{team_slug}	write	UAT
IAT	
PUT /orgs/{org}/teams/{team_slug}/memberships/{username}	write	UAT
IAT	
DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}	write	UAT
IAT	
PATCH /teams/{team_id}	write	UAT
IAT	
DELETE /teams/{team_id}	write	UAT
IAT	
PUT /teams/{team_id}/members/{username}	write	UAT
IAT	
DELETE /teams/{team_id}/members/{username}	write	UAT
IAT	
PUT /teams/{team_id}/memberships/{username}	write	UAT
IAT	
DELETE /teams/{team_id}/memberships/{username}	write	UAT
IAT	
PATCH /user/memberships/orgs/{org}	write	UAT
GET /orgs/{org}/failed_invitations	read	UAT
IAT	
GET /orgs/{org}/invitations	read	UAT
IAT	
GET /orgs/{org}/invitations/{invitation_id}/teams	read	UAT
IAT	
GET /orgs/{org}/members	read	UAT
IAT	
GET /orgs/{org}/members/{username}	read	UAT
IAT	
GET /orgs/{org}/memberships/{username}	read	UAT
IAT	
GET /orgs/{org}/organization-roles/{role_id}/teams	read	UAT
IAT	
GET /orgs/{org}/organization-roles/{role_id}/users	read	UAT
IAT	
GET /orgs/{org}/outside_collaborators	read	UAT
IAT	
GET /orgs/{org}/public_members	read	UAT
IAT	
GET /orgs/{org}/public_members/{username}	read	UAT
IAT	
GET /orgs/{org}/teams	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}/invitations	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}/members	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}/memberships/{username}	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}/repos	read	UAT
IAT	
GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/teams/{team_slug}/teams	read	UAT
IAT	
GET /teams/{team_id}	read	UAT
IAT	
GET /teams/{team_id}/invitations	read	UAT
IAT	
GET /teams/{team_id}/members	read	UAT
IAT	
GET /teams/{team_id}/members/{username}	read	UAT
IAT	
GET /teams/{team_id}/memberships/{username}	read	UAT
IAT	
GET /teams/{team_id}/repos	read	UAT
IAT	
GET /teams/{team_id}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /teams/{team_id}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /teams/{team_id}/repos/{owner}/{repo}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /teams/{team_id}/teams	read	UAT
IAT	
GET /user/memberships/orgs/{org}	read	UAT
Organization permissions for "Network configurations"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/settings/network-configurations	write	UAT
IAT	
PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}	write	UAT
IAT	
DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}	write	UAT
IAT	
GET /orgs/{org}/settings/network-configurations	read	UAT
IAT	
GET /orgs/{org}/settings/network-configurations/{network_configuration_id}	read	UAT
IAT	
GET /orgs/{org}/settings/network-settings/{network_settings_id}	read	UAT
IAT	
Organization permissions for "Organization Copilot metrics"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/copilot/metrics/reports/organization-1-day	read	UAT
IAT	
GET /orgs/{org}/copilot/metrics/reports/organization-28-day/latest	read	UAT
IAT	
GET /orgs/{org}/copilot/metrics/reports/repos-1-day	read	UAT
IAT	
GET /orgs/{org}/copilot/metrics/reports/user-teams-1-day	read	UAT
IAT	
GET /orgs/{org}/copilot/metrics/reports/users-1-day	read	UAT
IAT	
GET /orgs/{org}/copilot/metrics/reports/users-28-day/latest	read	UAT
IAT	
Organization permissions for "Organization codespaces secrets"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/codespaces/secrets/{secret_name}	write	UAT
IAT	
DELETE /orgs/{org}/codespaces/secrets/{secret_name}	write	UAT
IAT	
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/codespaces/secrets	read	UAT
IAT	
GET /orgs/{org}/codespaces/secrets/public-key	read	UAT
IAT	
GET /orgs/{org}/codespaces/secrets/{secret_name}	read	UAT
IAT	
GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories	read	UAT
IAT	
Organization permissions for "Organization codespaces settings"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/codespaces/access	write	UAT
IAT	
POST /orgs/{org}/codespaces/access/selected_users	write	UAT
IAT	
DELETE /orgs/{org}/codespaces/access/selected_users	write	UAT
IAT	
Organization permissions for "Organization codespaces"
Endpoint	Access	Token types	Additional permissions
DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/codespaces	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/members/{username}/codespaces	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Organization permissions for "Organization dependabot secrets"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/dependabot/secrets/{secret_name}	write	UAT
IAT	
DELETE /orgs/{org}/dependabot/secrets/{secret_name}	write	UAT
IAT	
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/dependabot/secrets	read	UAT
IAT	
GET /orgs/{org}/dependabot/secrets/public-key	read	UAT
IAT	
GET /orgs/{org}/dependabot/secrets/{secret_name}	read	UAT
IAT	
GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories	read	UAT
IAT	
Organization permissions for "Organization private registries"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/private-registries	write	UAT
IAT	
PATCH /orgs/{org}/private-registries/{secret_name}	write	UAT
IAT	
DELETE /orgs/{org}/private-registries/{secret_name}	write	UAT
IAT	
GET /orgs/{org}/private-registries	read	UAT
IAT	
GET /orgs/{org}/private-registries/public-key	read	UAT
IAT	
GET /orgs/{org}/private-registries/{secret_name}	read	UAT
IAT	
Organization permissions for "Personal access token requests"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/personal-access-token-requests	write	UAT
IAT	
POST /orgs/{org}/personal-access-token-requests/{pat_request_id}	write	UAT
IAT	
GET /orgs/{org}/personal-access-token-requests	read	UAT
IAT	
GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories	read	UAT
IAT	
Organization permissions for "Personal access tokens"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/personal-access-tokens	write	UAT
IAT	
POST /orgs/{org}/personal-access-tokens/{pat_id}	write	UAT
IAT	
GET /orgs/{org}/personal-access-tokens	read	UAT
IAT	
GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories	read	UAT
IAT	
Organization permissions for "Projects"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/projectsV2/{project_number}/drafts	write	UAT
IAT	
POST /orgs/{org}/projectsV2/{project_number}/fields	write	UAT
IAT	
POST /orgs/{org}/projectsV2/{project_number}/items	write	UAT
IAT	
PATCH /orgs/{org}/projectsV2/{project_number}/items/{item_id}	write	UAT
IAT	
DELETE /orgs/{org}/projectsV2/{project_number}/items/{item_id}	write	UAT
IAT	
POST /orgs/{org}/projectsV2/{project_number}/views	write	UAT
IAT	
GET /orgs/{org}/projectsV2	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}/fields	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}/items	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}/items/{item_id}	read	UAT
IAT	
GET /orgs/{org}/projectsV2/{project_number}/views/{view_number}/items	read	UAT
IAT	
Organization permissions for "Secrets"
Endpoint	Access	Token types	Additional permissions
PUT /orgs/{org}/actions/secrets/{secret_name}	write	UAT
IAT	
DELETE /orgs/{org}/actions/secrets/{secret_name}	write	UAT
IAT	
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/actions/secrets	read	UAT
IAT	
GET /orgs/{org}/actions/secrets/public-key	read	UAT
IAT	
GET /orgs/{org}/actions/secrets/{secret_name}	read	UAT
IAT	
GET /orgs/{org}/actions/secrets/{secret_name}/repositories	read	UAT
IAT	
Organization permissions for "Self-hosted runners"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/actions/runner-groups	write	UAT
IAT	
PATCH /orgs/{org}/actions/runner-groups/{runner_group_id}	write	UAT
IAT	
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}	write	UAT
IAT	
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories	write	UAT
IAT	
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners	write	UAT
IAT	
PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}	write	UAT
IAT	
DELETE /orgs/{org}/actions/runner-groups/{runner_group_id}/runners/{runner_id}	write	UAT
IAT	
POST /orgs/{org}/actions/runners/generate-jitconfig	write	UAT
IAT	
POST /orgs/{org}/actions/runners/registration-token	write	UAT
IAT	
POST /orgs/{org}/actions/runners/remove-token	write	UAT
IAT	
DELETE /orgs/{org}/actions/runners/{runner_id}	write	UAT
IAT	
POST /orgs/{org}/actions/runners/{runner_id}/labels	write	UAT
IAT	
PUT /orgs/{org}/actions/runners/{runner_id}/labels	write	UAT
IAT	
DELETE /orgs/{org}/actions/runners/{runner_id}/labels	write	UAT
IAT	
DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}	write	UAT
IAT	
GET /orgs/{org}/actions/runner-groups	read	UAT
IAT	
GET /orgs/{org}/actions/runner-groups/{runner_group_id}	read	UAT
IAT	
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners	read	UAT
IAT	
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories	read	UAT
IAT	
GET /orgs/{org}/actions/runner-groups/{runner_group_id}/runners	read	UAT
IAT	
GET /orgs/{org}/actions/runners	read	UAT
IAT	
GET /orgs/{org}/actions/runners/deprecations/{version}	read	UAT
IAT	
GET /orgs/{org}/actions/runners/downloads	read	UAT
IAT	
GET /orgs/{org}/actions/runners/{runner_id}	read	UAT
IAT	
GET /orgs/{org}/actions/runners/{runner_id}/labels	read	UAT
IAT	
Organization permissions for "Variables"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/actions/variables	write	UAT
IAT	
PATCH /orgs/{org}/actions/variables/{name}	write	UAT
IAT	
DELETE /orgs/{org}/actions/variables/{name}	write	UAT
IAT	
PUT /orgs/{org}/actions/variables/{name}/repositories	write	UAT
IAT	
PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/actions/variables	read	UAT
IAT	
GET /orgs/{org}/actions/variables/{name}	read	UAT
IAT	
GET /orgs/{org}/actions/variables/{name}/repositories	read	UAT
IAT	
Organization permissions for "Webhooks"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/hooks	write	UAT
IAT	
PATCH /orgs/{org}/hooks/{hook_id}	write	UAT
IAT	
DELETE /orgs/{org}/hooks/{hook_id}	write	UAT
IAT	
PATCH /orgs/{org}/hooks/{hook_id}/config	write	UAT
IAT	
POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts	write	UAT
IAT	
POST /orgs/{org}/hooks/{hook_id}/pings	write	UAT
IAT	
GET /orgs/{org}/hooks	read	UAT
IAT	
GET /orgs/{org}/hooks/{hook_id}	read	UAT
IAT	
GET /orgs/{org}/hooks/{hook_id}/config	read	UAT
IAT	
GET /orgs/{org}/hooks/{hook_id}/deliveries	read	UAT
IAT	
GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}	read	UAT
IAT	
Repository permissions for "Actions"
Endpoint	Access	Token types	Additional permissions
DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/caches	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/oidc/customization/sub	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable	write	UAT
IAT	
GET /repos/{owner}/{repo}/actions/artifacts	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/cache/storage-limit	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/cache/usage	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/caches	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/concurrency_groups	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/concurrency_groups/{concurrency_group_name}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/jobs/{job_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/steps/{step_number}/logs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/oidc/customization/sub	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/concurrency_groups	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/workflows	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}	read	UAT
IAT	
Repository permissions for "Administration"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/repos	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/cache/retention-limit	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/cache/storage-limit	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/access	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/selected-actions	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/permissions/workflow	write	UAT
IAT	
GET /repos/{owner}/{repo}/actions/policies	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/policies	write	UAT
IAT	
GET /repos/{owner}/{repo}/actions/policies/{policy_id}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/policies/{policy_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/policies/{policy_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runners/registration-token	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runners/remove-token	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels	write	UAT
IAT	
PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}	write	UAT
IAT	
POST /repos/{owner}/{repo}/autolinks	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/automated-security-fixes	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/automated-security-fixes	write	UAT
IAT	
PUT /repos/{owner}/{repo}/branches/{branch}/protection	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts	write	UAT
IAT	
PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps	write	UAT
IAT	
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams	write	UAT
IAT	
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams	write	UAT
IAT	
POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users	write	UAT
IAT	
PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users	write	UAT
IAT	
GET /repos/{owner}/{repo}/code-quality/setup	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/code-quality/setup	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/code-scanning/ai-scan	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/code-scanning/default-setup	write	UAT
IAT	
PUT /repos/{owner}/{repo}/collaborators/{username}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/collaborators/{username}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/environments/{environment_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/environments/{environment_name}	write	UAT
IAT	
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies	write	UAT
IAT	
PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/forks	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/immutable-releases	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/immutable-releases	write	UAT
IAT	
PUT /repos/{owner}/{repo}/interaction-limits	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/interaction-limits	write	UAT
IAT	
GET /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list	write	UAT
IAT	
PUT /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/interaction-limits/pulls/bypass-list	write	UAT
IAT	
GET /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/interaction-limits/pulls/creation-cap	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/invitations/{invitation_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/invitations/{invitation_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/keys	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/keys/{key_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/pages/health	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/private-vulnerability-reporting	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/private-vulnerability-reporting	write	UAT
IAT	
POST /repos/{owner}/{repo}/rulesets	write	UAT
IAT	
PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}	write	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history	write	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}	write	UAT
IAT	
GET /repos/{owner}/{repo}/secret-scanning/custom-patterns	write	UAT
IAT	
POST /repos/{owner}/{repo}/secret-scanning/custom-patterns	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/secret-scanning/custom-patterns	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/secret-scanning/custom-patterns/{pattern_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/topics	write	UAT
IAT	
POST /repos/{owner}/{repo}/transfer	write	UAT
PUT /repos/{owner}/{repo}/vulnerability-alerts	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/vulnerability-alerts	write	UAT
IAT	
POST /repos/{template_owner}/{template_repo}/generate	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /teams/{team_id}/repos/{owner}/{repo}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /teams/{team_id}/repos/{owner}/{repo}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /user/repos	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /user/repository_invitations/{invitation_id}	write	UAT
DELETE /user/repository_invitations/{invitation_id}	write	UAT
GET /repos/{owner}/{repo}/actions/cache/retention-limit	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/access	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/artifact-and-log-retention	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-contributor-approval	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/fork-pr-workflows-private-repos	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/selected-actions	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/permissions/workflow	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runners	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runners/deprecations/{version}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runners/downloads	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runners/{runner_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels	read	UAT
IAT	
GET /repos/{owner}/{repo}/autolinks	read	UAT
IAT	
GET /repos/{owner}/{repo}/autolinks/{autolink_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/automated-security-fixes	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/default-setup	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-security-configuration	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps	read	UAT
IAT	
GET /repos/{owner}/{repo}/immutable-releases	read	UAT
IAT	
GET /repos/{owner}/{repo}/interaction-limits	read	UAT
IAT	
GET /repos/{owner}/{repo}/invitations	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/keys	read	UAT
IAT	
GET /repos/{owner}/{repo}/keys/{key_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets/rule-suites	read	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/teams	read	UAT
IAT	
GET /repos/{owner}/{repo}/traffic/clones	read	UAT
IAT	
GET /repos/{owner}/{repo}/traffic/popular/paths	read	UAT
IAT	
GET /repos/{owner}/{repo}/traffic/popular/referrers	read	UAT
IAT	
GET /repos/{owner}/{repo}/traffic/views	read	UAT
IAT	
GET /repos/{owner}/{repo}/vulnerability-alerts	read	UAT
IAT	
GET /user/repository_invitations	read	UAT
Repository permissions for "Agent secrets"
Endpoint	Access	Token types	Additional permissions
PUT /repos/{owner}/{repo}/agents/secrets/{secret_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/agents/secrets/{secret_name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/agents/organization-secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/agents/secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/agents/secrets/public-key	read	UAT
IAT	
GET /repos/{owner}/{repo}/agents/secrets/{secret_name}	read	UAT
IAT	
Repository permissions for "Agent variables"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/agents/variables	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/agents/variables/{name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/agents/variables/{name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/agents/organization-variables	read	UAT
IAT	
GET /repos/{owner}/{repo}/agents/variables	read	UAT
IAT	
GET /repos/{owner}/{repo}/agents/variables/{name}	read	UAT
IAT	
Repository permissions for "Artifact metadata"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/artifacts/metadata/deployment-record	write	UAT
IAT	
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}	write	UAT
IAT	
POST /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs	write	UAT
IAT	
POST /orgs/{org}/artifacts/metadata/storage-record	write	UAT
IAT	
GET /orgs/{org}/artifacts/metadata/deployment-record/cluster/{cluster}/jobs/{job_id}	read	UAT
IAT	
GET /orgs/{org}/artifacts/{subject_digest}/metadata/deployment-records	read	UAT
IAT	
GET /orgs/{org}/artifacts/{subject_digest}/metadata/storage-records	read	UAT
IAT	
Repository permissions for "Attestations"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/attestations/delete-request	write	UAT
IAT	
DELETE /orgs/{org}/attestations/digest/{subject_digest}	write	UAT
IAT	
DELETE /orgs/{org}/attestations/{attestation_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/attestations	write	UAT
IAT	
POST /users/{username}/attestations/delete-request	write	UAT
IAT	
DELETE /users/{username}/attestations/digest/{subject_digest}	write	UAT
IAT	
DELETE /users/{username}/attestations/{attestation_id}	write	UAT
IAT	
GET /orgs/{org}/attestations/repositories	read	UAT
IAT	
GET /repos/{owner}/{repo}/attestations/{subject_digest}	read	UAT
IAT	
Repository permissions for "Checks"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/check-runs	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest	write	UAT
IAT	
POST /repos/{owner}/{repo}/check-suites	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/check-suites/preferences	write	UAT
IAT	
POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest	write	UAT
IAT	
GET /repos/{owner}/{repo}/check-runs/{check_run_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations	read	UAT
IAT	
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{ref}/check-runs	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{ref}/check-suites	read	UAT
IAT	
Repository permissions for "Code quality"
Endpoint	Access	Token types	Additional permissions
GET /repos/{owner}/{repo}/code-quality/findings	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-quality/findings/{finding_number}	read	UAT
IAT	
Repository permissions for "Code scanning alerts"
Endpoint	Access	Token types	Additional permissions
PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}	write	UAT
IAT	
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/code-scanning/sarifs	write	UAT
IAT	
GET /orgs/{org}/code-scanning/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/ai-scan	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/analyses	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}	read	UAT
IAT	
Repository permissions for "Codespaces lifecycle admin"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /user/codespaces/{codespace_name}/exports	write	UAT
POST /user/codespaces/{codespace_name}/start	write	UAT
POST /user/codespaces/{codespace_name}/stop	write	UAT
GET /user/codespaces/{codespace_name}/exports/{export_id}	read	UAT
Repository permissions for "Codespaces metadata"
Endpoint	Access	Token types	Additional permissions
GET /repos/{owner}/{repo}/codespaces/devcontainers	read	UAT
IAT	
GET /repos/{owner}/{repo}/codespaces/machines	read	UAT
IAT	
GET /user/codespaces/{codespace_name}/machines	read	UAT
Repository permissions for "Codespaces secrets"
Endpoint	Access	Token types	Additional permissions
GET /repos/{owner}/{repo}/codespaces/secrets	write	UAT
IAT	
GET /repos/{owner}/{repo}/codespaces/secrets/public-key	write	UAT
IAT	
GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}	write	UAT
IAT	
Repository permissions for "Codespaces"
Endpoint	Access	Token types	Additional permissions
DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/codespaces	write	UAT
GET /repos/{owner}/{repo}/codespaces/new	write	UAT
GET /repos/{owner}/{repo}/codespaces/permissions_check	write	UAT
POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces	write	UAT
POST /user/codespaces	write	UAT
PATCH /user/codespaces/{codespace_name}	write	UAT
DELETE /user/codespaces/{codespace_name}	write	UAT
POST /user/codespaces/{codespace_name}/publish	write	UAT
GET /orgs/{org}/codespaces	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /orgs/{org}/members/{username}/codespaces	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/codespaces	read	UAT
GET /user/codespaces	read	UAT
GET /user/codespaces/{codespace_name}	read	UAT
Repository permissions for "Commit statuses"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/statuses/{sha}	write	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{ref}/status	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{ref}/statuses	read	UAT
IAT	
Repository permissions for "Contents"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/branches/{branch}/rename	write	UAT
IAT	
POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}	write	UAT
IAT	
POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/comments/{comment_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/comments/{comment_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/comments/{comment_id}/reactions	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/dependency-graph/snapshots	write	UAT
IAT	
POST /repos/{owner}/{repo}/dispatches	write	UAT
IAT	
POST /repos/{owner}/{repo}/git/blobs	write	UAT
IAT	
POST /repos/{owner}/{repo}/git/commits	write	UAT
IAT	
POST /repos/{owner}/{repo}/git/refs	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/git/refs	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/git/refs/{ref}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/git/refs/{ref}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/git/refs/{ref}	write	UAT
IAT	
POST /repos/{owner}/{repo}/git/tags	write	UAT
IAT	
POST /repos/{owner}/{repo}/git/trees	write	UAT
IAT	
PUT /repos/{owner}/{repo}/import	write	UAT
PATCH /repos/{owner}/{repo}/import	write	UAT
DELETE /repos/{owner}/{repo}/import	write	UAT
PATCH /repos/{owner}/{repo}/import/authors/{author_id}	write	UAT
PATCH /repos/{owner}/{repo}/import/lfs	write	UAT
POST /repos/{owner}/{repo}/merge-upstream	write	UAT
IAT	
POST /repos/{owner}/{repo}/merges	write	UAT
IAT	
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge	write	UAT
IAT	
PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async	write	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}	write	UAT
IAT	
POST /repos/{owner}/{repo}/releases	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/releases	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/releases/generate-notes	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/releases/{release_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/releases/{release_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/releases/{release_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/secret-scanning/push-protection-bypasses	write	UAT
GET /repos/{owner}/{repo}/stargazers	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/subscribers	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /markdown	read	UAT
IAT	
GET /repos/{owner}/{repo}/activity	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches	read	UAT
IAT	
GET /repos/{owner}/{repo}/branches/{branch}	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/codeql/databases	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}	read	UAT
IAT	
GET /repos/{owner}/{repo}/codeowners/errors	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head	read	UAT
IAT	
POST /repos/{owner}/{repo}/commits/{commit_sha}/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{ref}	read	UAT
IAT	
GET /repos/{owner}/{repo}/community/profile	read	UAT
IAT	
GET /repos/{owner}/{repo}/compare/{basehead}	read	UAT
IAT	
GET /repos/{owner}/{repo}/contents/{path}	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependency-graph/sbom	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{sbom_uuid}	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report	read	UAT
IAT	
POST /repos/{owner}/{repo}/forks	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/forks	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/git/blobs/{file_sha}	read	UAT
IAT	
GET /repos/{owner}/{repo}/git/commits/{commit_sha}	read	UAT
IAT	
GET /repos/{owner}/{repo}/git/matching-refs/{ref}	read	UAT
IAT	
GET /repos/{owner}/{repo}/git/ref/{ref}	read	UAT
IAT	
GET /repos/{owner}/{repo}/git/tags/{tag_sha}	read	UAT
IAT	
GET /repos/{owner}/{repo}/git/trees/{tree_sha}	read	UAT
IAT	
GET /repos/{owner}/{repo}/import	read	UAT
GET /repos/{owner}/{repo}/import/authors	read	UAT
GET /repos/{owner}/{repo}/import/large_files	read	UAT
GET /repos/{owner}/{repo}/pulls/{pull_number}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/readme	read	UAT
IAT	
GET /repos/{owner}/{repo}/readme/{dir}	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases/assets/{asset_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases/latest	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases/tags/{tag}	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases/{release_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/releases/{release_id}/assets	read	UAT
IAT	
GET /repos/{owner}/{repo}/tarball/{ref}	read	UAT
IAT	
GET /repos/{owner}/{repo}/zipball/{ref}	read	UAT
IAT	
POST /repos/{template_owner}/{template_repo}/generate	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{template_owner}/{template_repo}/generate	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Repository permissions for "Copilot agent settings"
Endpoint	Access	Token types	Additional permissions
GET /repos/{owner}/{repo}/copilot/cloud-agent/configuration	read	UAT
IAT	
Repository permissions for "Custom properties"
Endpoint	Access	Token types	Additional permissions
PATCH /repos/{owner}/{repo}/properties/values	write	UAT
IAT	
Repository permissions for "Dependabot alerts"
Endpoint	Access	Token types	Additional permissions
PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}	write	UAT
IAT	
GET /orgs/{org}/dependabot/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependabot/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}	read	UAT
IAT	
Repository permissions for "Dependabot secrets"
Endpoint	Access	Token types	Additional permissions
PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/dependabot/secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependabot/secrets/public-key	read	UAT
IAT	
GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}	read	UAT
IAT	
Repository permissions for "Deployments"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule	write	
IAT	
POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments	write	UAT
IAT	
POST /repos/{owner}/{repo}/deployments	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/deployments/{deployment_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses	write	UAT
IAT	
GET /repos/{owner}/{repo}/deployments	read	UAT
IAT	
GET /repos/{owner}/{repo}/deployments/{deployment_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses	read	UAT
IAT	
GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}	read	UAT
IAT	
Repository permissions for "Environments"
Endpoint	Access	Token types	Additional permissions
PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}	write	UAT
IAT	
POST /repos/{owner}/{repo}/environments/{environment_name}/variables	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/variables	read	UAT
IAT	
GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}	read	UAT
IAT	
Repository permissions for "GitHub App installation repository access"
Endpoint	Access	Token types	Additional permissions
PUT /user/installations/{installation_id}/repositories/{repository_id}	write	UAT
IAT	
DELETE /user/installations/{installation_id}/repositories/{repository_id}	write	UAT
IAT	
Repository permissions for "Issues"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/issues	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/comments/{comment_id}/pin	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/pin	write	UAT
IAT	
POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/issues/{issue_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/assignees	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/comments	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values/{issue_field_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/lock	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/reactions	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/issues/{issue_number}/relates_to	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/{issue_number}/relates_to/{issue_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue	write	UAT
IAT	
POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority	write	UAT
IAT	
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/approve	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/dismiss	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/milestones	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/milestones/{milestone_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/milestones/{milestone_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/assignees	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/assignees/{assignee}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/comments	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/comments/{comment_id}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/events	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/events/{event_id}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/comments	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/events	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/parent	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/reactions	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/relates_to	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/{issue_number}/suggestions	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/timeline	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/labels/{name}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones/{milestone_number}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Repository permissions for "Metadata"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/repos	read	UAT
IAT	
GET /repos/{owner}/{repo}	read	UAT
IAT	
GET /repos/{owner}/{repo}/collaborators	read	UAT
IAT	
GET /repos/{owner}/{repo}/collaborators/{username}	read	UAT
IAT	
GET /repos/{owner}/{repo}/collaborators/{username}/permission	read	UAT
IAT	
GET /repos/{owner}/{repo}/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/comments/{comment_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/comments/{comment_id}/reactions	read	UAT
IAT	
GET /repos/{owner}/{repo}/commits/{commit_sha}/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/contributors	read	UAT
IAT	
GET /repos/{owner}/{repo}/events	read	UAT
IAT	
GET /repos/{owner}/{repo}/forks	read	UAT
IAT	
GET /repos/{owner}/{repo}/hash-algorithm	read	UAT
IAT	
GET /repos/{owner}/{repo}/issue-types	read	UAT
IAT	
GET /repos/{owner}/{repo}/languages	read	UAT
IAT	
GET /repos/{owner}/{repo}/license	read	UAT
IAT	
GET /repos/{owner}/{repo}/private-vulnerability-reporting	read	UAT
IAT	
GET /repos/{owner}/{repo}/properties/values	read	UAT
IAT	
GET /repos/{owner}/{repo}/rules/branches/{branch}	read	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets	read	UAT
IAT	
GET /repos/{owner}/{repo}/rulesets/{ruleset_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/stargazers/count	read	UAT
IAT	
GET /repos/{owner}/{repo}/stargazers/history	read	UAT
IAT	
GET /repos/{owner}/{repo}/stats/code_frequency	read	UAT
IAT	
GET /repos/{owner}/{repo}/stats/commit_activity	read	UAT
IAT	
GET /repos/{owner}/{repo}/stats/contributors	read	UAT
IAT	
GET /repos/{owner}/{repo}/stats/participation	read	UAT
IAT	
GET /repos/{owner}/{repo}/stats/punch_card	read	UAT
IAT	
GET /repos/{owner}/{repo}/tags	read	UAT
IAT	
GET /repos/{owner}/{repo}/topics	read	UAT
IAT	
GET /repositories	read	UAT
IAT	
GET /search/labels	read	UAT
IAT	
GET /user/installations/{installation_id}/repositories	read	UAT
GET /user/repos	read	UAT
GET /users/{username}/repos	read	UAT
IAT	
Repository permissions for "Pages"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/pages	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/pages/builds	write	UAT
IAT	
POST /repos/{owner}/{repo}/pages/deployments	write	UAT
IAT	
POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel	write	UAT
IAT	
GET /repos/{owner}/{repo}/pages/health	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/pages	read	UAT
IAT	
GET /repos/{owner}/{repo}/pages/builds	read	UAT
IAT	
GET /repos/{owner}/{repo}/pages/builds/latest	read	UAT
IAT	
GET /repos/{owner}/{repo}/pages/builds/{build_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}	read	UAT
IAT	
Repository permissions for "Pull requests"
Endpoint	Access	Token types	Additional permissions
PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/issues/{issue_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/assignees	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/comments	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/issue-field-values/{issue_field_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PUT /repos/{owner}/{repo}/issues/{issue_number}/lock	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/approve	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/issues/{issue_number}/suggestions/{suggestion_id}/dismiss	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/labels	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/labels/{name}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/milestones	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/milestones/{milestone_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/milestones/{milestone_number}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/pulls	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/pulls/{pull_number}	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers/rerequest	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews	write	UAT
IAT	
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}	write	UAT
IAT	
PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals	write	UAT
IAT	
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events	write	UAT
IAT	
PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch	write	UAT
IAT	
POST /repos/{owner}/{repo}/stacks	write	UAT
IAT	
POST /repos/{owner}/{repo}/stacks/{stack_number}/add	write	UAT
IAT	
POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack	write	UAT
IAT	
GET /repos/{owner}/{repo}/assignees	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/assignees/{assignee}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls	read	UAT
IAT	
GET /repos/{owner}/{repo}/issues/comments	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/comments/{comment_id}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/events/{event_id}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/comments	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/events	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/suggestions	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/issues/{issue_number}/timeline	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/labels/{name}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones/{milestone_number}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/pulls	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /repos/{owner}/{repo}/pulls/{pull_number}/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/commits	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/files	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/merge	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments	read	UAT
IAT	
GET /repos/{owner}/{repo}/stacks	read	UAT
IAT	
GET /repos/{owner}/{repo}/stacks/{stack_number}	read	UAT
IAT	
Repository permissions for "Repository creation"
Endpoint	Access	Token types	Additional permissions
POST /orgs/{org}/repos	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/forks	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{template_owner}/{template_repo}/generate	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /user/repos	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Repository permissions for "Repository security advisories"
Endpoint	Access	Token types	Additional permissions
GET /orgs/{org}/security-advisories	write	UAT
IAT	
POST /repos/{owner}/{repo}/security-advisories	write	UAT
IAT	
POST /repos/{owner}/{repo}/security-advisories/reports	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}	write	UAT
IAT	
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve	write	UAT
IAT	
GET /repos/{owner}/{repo}/security-advisories	read	UAT
IAT	
GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}	read	UAT
IAT	
POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
Repository permissions for "Secret scanning alerts"
Endpoint	Access	Token types	Additional permissions
PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}	write	UAT
IAT	
GET /orgs/{org}/secret-scanning/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/secret-scanning/alerts	read	UAT
IAT	
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}	read	UAT
IAT	
GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations	read	UAT
IAT	
GET /repos/{owner}/{repo}/secret-scanning/scan-history	read	UAT
IAT	
Repository permissions for "Secrets"
Endpoint	Access	Token types	Additional permissions
PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/actions/organization-secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/secrets	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/secrets/public-key	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/secrets/{secret_name}	read	UAT
IAT	
Repository permissions for "Variables"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/actions/variables	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/actions/variables/{name}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/actions/variables/{name}	write	UAT
IAT	
GET /repos/{owner}/{repo}/actions/organization-variables	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/variables	read	UAT
IAT	
GET /repos/{owner}/{repo}/actions/variables/{name}	read	UAT
IAT	
Repository permissions for "Webhooks"
Endpoint	Access	Token types	Additional permissions
POST /repos/{owner}/{repo}/hooks	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/hooks/{hook_id}	write	UAT
IAT	
DELETE /repos/{owner}/{repo}/hooks/{hook_id}	write	UAT
IAT	
PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config	write	UAT
IAT	
POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts	write	UAT
IAT	
GET /repos/{owner}/{repo}/hooks	read	UAT
IAT	
GET /repos/{owner}/{repo}/hooks/{hook_id}	read	UAT
IAT	
GET /repos/{owner}/{repo}/hooks/{hook_id}/config	read	UAT
IAT	
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries	read	UAT
IAT	
GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}	read	UAT
IAT	
POST /repos/{owner}/{repo}/hooks/{hook_id}/pings	read	UAT
IAT	
POST /repos/{owner}/{repo}/hooks/{hook_id}/tests	read	UAT
IAT	
Repository permissions for "Workflows"
Endpoint	Access	Token types	Additional permissions
PUT /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /repos/{owner}/{repo}/contents/{path}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/git/refs	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/git/refs/{ref}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
POST /repos/{owner}/{repo}/releases	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
PATCH /repos/{owner}/{repo}/releases/{release_id}	write	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
User permissions for "Block another user"
Endpoint	Access	Token types	Additional permissions
PUT /user/blocks/{username}	write	UAT
DELETE /user/blocks/{username}	write	UAT
GET /user/blocks	read	UAT
GET /user/blocks/{username}	read	UAT
User permissions for "Codespaces user secrets"
Endpoint	Access	Token types	Additional permissions
PUT /user/codespaces/secrets/{secret_name}	write	UAT
DELETE /user/codespaces/secrets/{secret_name}	write	UAT
PUT /user/codespaces/secrets/{secret_name}/repositories	write	UAT
PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}	write	UAT
Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}	write	UAT
Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /user/codespaces/secrets	read	UAT
GET /user/codespaces/secrets/public-key	read	UAT
GET /user/codespaces/secrets/{secret_name}	read	UAT
GET /user/codespaces/secrets/{secret_name}/repositories	read	UAT
User permissions for "Email addresses"
Endpoint	Access	Token types	Additional permissions
PATCH /user/email/visibility	write	UAT
POST /user/emails	write	UAT
DELETE /user/emails	write	UAT
GET /user/emails	read	UAT
GET /user/public_emails	read	UAT
User permissions for "Followers"
Endpoint	Access	Token types	Additional permissions
PUT /user/following/{username}	write	UAT
DELETE /user/following/{username}	write	UAT
GET /user/followers	read	UAT
GET /user/following	read	UAT
GET /user/following/{username}	read	UAT
User permissions for "GPG keys"
Endpoint	Access	Token types	Additional permissions
POST /user/gpg_keys	write	UAT
DELETE /user/gpg_keys/{gpg_key_id}	write	UAT
GET /user/gpg_keys	read	UAT
GET /user/gpg_keys/{gpg_key_id}	read	UAT
User permissions for "Gists"
Endpoint	Access	Token types	Additional permissions
POST /gists	write	UAT
PATCH /gists/{gist_id}	write	UAT
DELETE /gists/{gist_id}	write	UAT
POST /gists/{gist_id}/comments	write	UAT
PATCH /gists/{gist_id}/comments/{comment_id}	write	UAT
DELETE /gists/{gist_id}/comments/{comment_id}	write	UAT
POST /gists/{gist_id}/forks	write	UAT
PUT /gists/{gist_id}/star	write	UAT
DELETE /gists/{gist_id}/star	write	UAT
User permissions for "Git SSH keys"
Endpoint	Access	Token types	Additional permissions
POST /user/keys	write	UAT
DELETE /user/keys/{key_id}	write	UAT
GET /user/keys	read	UAT
GET /user/keys/{key_id}	read	UAT
GET /users/{username}/keys	read	UAT
IAT	
User permissions for "Interaction limits"
Endpoint	Access	Token types	Additional permissions
PUT /user/interaction-limits	write	UAT
DELETE /user/interaction-limits	write	UAT
GET /user/interaction-limits	read	UAT
User permissions for "Plan"
Endpoint	Access	Token types	Additional permissions
GET /users/{username}/settings/billing/ai_credit/usage	read	UAT
GET /users/{username}/settings/billing/premium_request/usage	read	UAT
GET /users/{username}/settings/billing/usage	read	UAT
GET /users/{username}/settings/billing/usage/summary	read	UAT
User permissions for "Private repository invitations"
Endpoint	Access	Token types	Additional permissions
GET /repos/{owner}/{repo}/invitations	read	UAT
IAT	Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
User permissions for "Profile"
Endpoint	Access	Token types	Additional permissions
PATCH /user	write	UAT
POST /user/social_accounts	write	UAT
DELETE /user/social_accounts	write	UAT
User permissions for "SSH signing keys"
Endpoint	Access	Token types	Additional permissions
POST /user/ssh_signing_keys	write	UAT
DELETE /user/ssh_signing_keys/{ssh_signing_key_id}	write	UAT
GET /user/ssh_signing_keys	read	UAT
GET /user/ssh_signing_keys/{ssh_signing_key_id}	read	UAT
User permissions for "Starring"
Endpoint	Access	Token types	Additional permissions
PUT /user/starred/{owner}/{repo}	write	UAT
Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
DELETE /user/starred/{owner}/{repo}	write	UAT
Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /user/starred	read	UAT
GET /user/starred/{owner}/{repo}	read	UAT
Multiple permissions are required, or a different permission may be used. For more information about the permissions, see the documentation for this endpoint.
GET /users/{username}/starred	read	UAT
IAT	
User permissions for "Watching"
Endpoint	Access	Token types	Additional permissions
GET /user/subscriptions	read	UAT
GET /users/{username}/subscriptions	read	UAT
IAT	

Back to top
Help and support
Was this Doc helpful?

Help us make GitHub Docs great!
All Docs are open source. See something that's wrong or unclear? Submit a pull request.

Still need help?
Ask the GitHub community
Contact support
Expert services
Blog
GitHub Inc. © 2026
Terms
Privacy
Status
Pricing

Permissions required for GitHub Apps - GitHub Docs
Copied! 

