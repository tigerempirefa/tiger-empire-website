
exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  function reply(statusCode, data) {
    return {
      statusCode,
      headers,
      body: JSON.stringify(data)
    };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Use POST." });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const password = process.env.ADMIN_PASSWORD;

  if (!token || !repo || !password) {
    return reply(500, {
      error: "Publishing settings are not configured."
    });
  }

  let post;

  try {
    post = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Invalid post data." });
  }

  if (post.password !== password) {
    return reply(401, { error: "Incorrect admin password." });
  }

  if (
    !["photo", "video", "news"].includes(post.type) ||
    typeof post.title !== "string" ||
    !post.title.trim()
  ) {
    return reply(400, { error: "Invalid post details." });
  }

  if (
    ["photo", "video"].includes(post.type) &&
    (!post.url || !/^https:\/\/res\.cloudinary\.com\//.test(post.url))
  ) {
    return reply(400, { error: "Use a valid Cloudinary URL." });
  }

  const api = "https://api.github.com/repos/" + repo +
    "/contents/data/posts.json";

  try {
    const options = {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    };

    const current = await fetch(api, options);
    let posts = [];
    let sha;

    if (current.status === 200) {
      const file = await current.json();
      sha = file.sha;
      posts = JSON.parse(
        Buffer.from(file.content, "base64").toString("utf8")
      );
    } else if (current.status !== 404) {
      throw new Error("Could not read the posts file.");
    }

    const savedPost = {
      type: post.type,
      title: post.title.trim(),
      url: post.url || "",
      content: post.content || "",
      created_at: new Date().toISOString()
    };

    posts.unshift(savedPost);

    const update = await fetch(api, {
      method: "PUT",
      headers: {
        ...options.headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Publish Tiger Empire post",
        content: Buffer.from(
          JSON.stringify(posts, null, 2)
        ).toString("base64"),
        ...(sha ? { sha } : {}),
        branch: "main"
      })
    });

    if (!update.ok) {
      throw new Error("GitHub could not save the post.");
    }

    return reply(200, {
      success: true,
      message: "Post saved to GitHub."
    });
  } catch (error) {
    console.error("Publishing error:", error.message);
    return reply(500, {
      error: "Publishing failed. Check the server settings."
    });
  }
};
