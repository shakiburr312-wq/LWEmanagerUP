async function enableApi() {
  try {
    console.log("Fetching metadata token...");
    const metadataRes = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" }
    });
    if (!metadataRes.ok) {
      throw new Error(`Failed to fetch metadata token: ${metadataRes.statusText}`);
    }
    const tokenData = await metadataRes.json();
    const token = tokenData.access_token;
    console.log("Token successfully fetched.");

    const project = "964913235776";
    console.log(`Enabling identitytoolkit.googleapis.com on project ${project}...`);
    const enableRes = await fetch(`https://serviceusage.googleapis.com/v1/projects/${project}/services/identitytoolkit.googleapis.com:enable`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const resultText = await enableRes.text();
    console.log("Response status:", enableRes.status);
    console.log("Response body:", resultText);
  } catch (err) {
    console.error("Error enabling API:", err);
  }
}

enableApi();
