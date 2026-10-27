
exports.handler = async function () {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

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

  if (!cloudName || !apiKey || !apiSecret) {
    return reply(500, {
      error: "Cloudinary settings are missing."
    });
  }

  try {
    const auth = Buffer.from(
      apiKey + ":" + apiSecret
    ).toString("base64");

    const types = ["image", "video"];

    const results = await Promise.all(
      types.map(async function (type) {
        const url =
          "https://api.cloudinary.com/v1_1/" +
          cloudName +
          "/resources/" +
          type +
          "/upload?max_results=100";

        const response = await fetch(url, {
          headers: {
            Authorization: "Basic " + auth
          }
        });

        if (!response.ok) {
          throw new Error(
            "Cloudinary returned HTTP " + response.status
          );
        }

        const data = await response.json();
        return data.resources || [];
      })
    );

    const media = results
      .flat()
      .map(function (item) {
        return {
          url: item.secure_url,
          type: item.resource_type === "video"
            ? "video"
            : "photo",
          title: "Tiger Empire Academy",
          created_at: item.created_at
        };
      })
      .filter(function (item) {
        return Boolean(item.url);
      });

    let news = [];

    if (token && repo) {
      const response = await fetch(
        "https://api.github.com/repos/" +
          repo +
          "/contents/data/posts.json?ref=main",
        {
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
          }
        }
      );

      if (response.ok) {
        const file = await response.json();
        const posts = JSON.parse(
          Buffer.from(file.content, "base64").toString("utf8")
        );

        
if (Array.isArray(posts)) {
  news = posts.filter(function (post) {
    return post &&
      ["photo", "video", "news"].includes(post.type) &&
      typeof post.title === "string" &&
      (
        post.type === "news" ||
        (
          typeof post.url === "string" &&
          post.url.startsWith("https://res.cloudinary.com/")
        )
      );
  });
}
        
      } else if (response.status !== 404) {
        throw new Error(
          "GitHub returned HTTP " + response.status
        );
      }
    }

    const resources = news.sort(function (a, b) {
  return new Date(b.created_at || 0) -
    new Date(a.created_at || 0);
});

return reply(200, { resources: resources });
  } catch (error) {
    console.error("Gallery loading error:", error.message);

    return reply(502, {
      error: "Unable to load gallery posts."
    });
  }
};
