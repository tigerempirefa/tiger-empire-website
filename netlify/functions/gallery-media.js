exports.handler = async function () {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Cloudinary settings are missing."
      })
    };
  }

  const auth = Buffer.from(
    apiKey + ":" + apiSecret
  ).toString("base64");

  try {
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
          throw new Error("Cloudinary request failed.");
        }

        const data = await response.json();
        return data.resources || [];
      })
    );

    const resources = results
      .flat()
      .map(function (item) {
        return {
          url: item.secure_url,
          type: item.resource_type === "video"
            ? "video"
            : "photo",
          title: item.public_id.split("/").pop(),
          created_at: item.created_at
        };
      })
      .filter(function (item) {
        return Boolean(item.url);
      });

    resources.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        resources: resources
      })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Unable to load Cloudinary media."
      })
    };
  }
};
