
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
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!token || !repo || !adminPassword) {
    return reply(500, {
      error: "Required Netlify environment variables are missing."
    });
  }

  try {
    const input = JSON.parse(event.body || "{}");

    if (input.password !== adminPassword) {
      return reply(401, { error: "Incorrect admin password." });
    }

    const action = input.action || "save";
    const name = String(input.name || "").trim();

    if (!name) {
      return reply(400, { error: "Enter the player's name." });
    }

    const apiUrl =
      "https://api.github.com/repos/" +
      repo +
      "/contents/data/players.json";

    const apiHeaders = {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    const fileResponse = await fetch(apiUrl, {
      headers: apiHeaders
    });

    if (!fileResponse.ok) {
      return reply(502, {
        error: "Could not read players.json from GitHub."
      });
    }

    const fileData = await fileResponse.json();
    const decoded = Buffer.from(
      fileData.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf8");
    
    const players = JSON.parse(decoded);

    const lookupName =
  action === "update"
    ? String(input.original_name || "").trim()
    : name;

const index = players.findIndex(
  player =>
    String(player.name || "").toLowerCase() ===
    lookupName.toLowerCase()
);
    

    
if (action === "get") {
  if (index === -1) {
    return reply(404, { error: "Player not found." });
  }

  return reply(200, {
    success: true,
    player: players[index]
  });
} else if (action === "delete") {
  
      if (index === -1) {
        return reply(404, { error: "Player not found." });
      }
      players.splice(index, 1);
} else if (action === "save" || action === "update") {
      const number = String(input.number || "").trim();
      const position = String(input.position || "").trim();
      const ageGroup = String(input.age_group || "").trim();
      const photo = String(input.photo || "").trim();

      if (!position || !ageGroup) {
        return reply(400, {
          error: "Enter the player's position and age group."
        });
      }

      if (photo) {
        try {
          const photoUrl = new URL(photo);
          if (
            photoUrl.protocol !== "https:" ||
            photoUrl.hostname !== "res.cloudinary.com"
          ) {
            throw new Error("Invalid photo URL");
          }
        } catch {
          return reply(400, {
            error: "Use a valid HTTPS Cloudinary photo URL."
          });
        }
      }

      const stats = {
        goals: Math.max(0, Number(input.goals) || 0),
        assists: Math.max(0, Number(input.assists) || 0),
        appearances: Math.max(0, Number(input.appearances) || 0)
      };

      if (
        !Number.isInteger(stats.goals) ||
        !Number.isInteger(stats.assists) ||
        !Number.isInteger(stats.appearances)
      ) {
        return reply(400, {
          error: "Statistics must be whole numbers."
        });
      }
if (action === "update" && index === -1) {
  return reply(404, {
    error: "Original player not found. Please load the player again."
  });
}
      const oldPlayer = index >= 0 ? players[index] : {};
      const player = {
        ...oldPlayer,
        name,
        number,
        position,
        age_group: ageGroup,
        photo: photo || oldPlayer.photo || "",
        ...stats
      };

      if (index >= 0) {
        players[index] = player;
      } else {
        players.push(player);
      }
    } else {
      return reply(400, { error: "Unknown action." });
    }

    const updatedContent = Buffer.from(
      JSON.stringify(players, null, 2)
    ).toString("base64");

    const saveResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        ...apiHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message:
          action === "delete"
            ? "Remove academy player"
            : "Add or update academy player",
        content: updatedContent,
        sha: fileData.sha,
        branch: "main"
      })
    });

    if (!saveResponse.ok) {
      return reply(502, {
        error: "GitHub could not save the player data."
      });
    }

    return reply(200, {
      success: true,
      message:
        action === "delete"
          ? "Player deleted successfully."
          : "Player profile saved successfully."
    });
  } catch (error) {
  return reply(500, {
    error: "Could not process the player request: " + error.message
  });
  }
};
