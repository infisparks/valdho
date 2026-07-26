const { CloudTasksClient } = require("@google-cloud/tasks");

let taskClientInstance = null;

/**
 * Helper to initialize CloudTasksClient with flexible environment credentials (Singleton pattern)
 */
function getCloudTasksClient() {
  if (taskClientInstance) return taskClientInstance;

  const options = {};
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey && serviceAccountKey.trim()) {
    try {
      let rawJson = serviceAccountKey.trim();
      if (!rawJson.startsWith("{")) {
        // Try base64 decoding
        rawJson = Buffer.from(rawJson, "base64").toString("utf-8");
      }
      const credentials = JSON.parse(rawJson);
      options.credentials = credentials;
      if (credentials.project_id) {
        options.projectId = credentials.project_id;
      }
    } catch (err) {
      console.warn("[Cloud Tasks ⚠️] Could not parse GCP_SERVICE_ACCOUNT_KEY as JSON/Base64. Falling back to default GCP auth:", err.message);
    }
  }

  if (process.env.GCP_PROJECT_ID) {
    options.projectId = process.env.GCP_PROJECT_ID;
  }

  taskClientInstance = new CloudTasksClient(options);
  return taskClientInstance;
}

/**
 * Schedules an HTTP Task in Google Cloud Tasks
 * 
 * @param {Object} params
 * @param {string} params.taskId - Unique Task ID (e.g. "task_919958399157_rule123_1720000000")
 * @param {string} params.url - Target HTTP Webhook URL (e.g. "https://first.infiplus.in/api/whatsapp/execute-task")
 * @param {Object} params.payload - JSON body to pass to the webhook
 * @param {number} params.scheduleTimeSeconds - Execution UNIX timestamp in seconds
 * @returns {Promise<{success: boolean, taskName?: string, error?: string}>}
 */
async function createScheduledHttpTask({ taskId, url, payload, scheduleTimeSeconds }) {
  const projectId = process.env.GCP_PROJECT_ID || "firstoption-8da25";
  const location = process.env.GCP_LOCATION || "asia-south1";
  const queueName = process.env.GCP_QUEUE_NAME || "whatsapp-automation-queue";
  const webhookSecret = process.env.WEBHOOK_SECRET || "valdho_gcp_tasks_sec_2026_x89";

  const sanitizedTaskId = String(taskId).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 450);
  let fullTaskName = "";

  try {
    const client = getCloudTasksClient();
    const parent = client.queuePath(projectId, location, queueName);
    fullTaskName = client.taskPath(projectId, location, queueName, sanitizedTaskId);

    const task = {
      name: fullTaskName,
      httpRequest: {
        httpMethod: "POST",
        url,
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      },
      scheduleTime: {
        seconds: scheduleTimeSeconds,
      },
    };

    console.log(`[Cloud Tasks 🚀] Enqueuing task '${sanitizedTaskId}' to fire at UNIX timestamp ${scheduleTimeSeconds} (Target IST: ${new Date(scheduleTimeSeconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })})`);

    const [response] = await client.createTask({ parent, task });
    console.log(`[Cloud Tasks ✅] Successfully scheduled Cloud Task: ${response.name}`);

    return {
      success: true,
      taskName: response.name,
      taskId: sanitizedTaskId,
      scheduledTimeSeconds: scheduleTimeSeconds,
    };
  } catch (err) {
    // Error code 6 = ALREADY_EXISTS in GCP gRPC (tombstoned task name from deleted/executed task within 1hr)
    if (err.code === 6 || (err.message && err.message.includes("ALREADY_EXISTS"))) {
      console.warn(`[Cloud Tasks ⚠️] Task name '${sanitizedTaskId}' is tombstoned or already exists in GCP. Re-trying with unique suffix...`);
      try {
        const retryTaskId = `${sanitizedTaskId}_r${Date.now().toString(36)}`;
        const retryFullTaskName = client.taskPath(projectId, location, queueName, retryTaskId);
        task.name = retryFullTaskName;
        const [retryResponse] = await client.createTask({ parent, task });
        console.log(`[Cloud Tasks ✅] Successfully scheduled Cloud Task with unique suffix: ${retryResponse.name}`);
        return {
          success: true,
          taskName: retryResponse.name,
          taskId: retryTaskId,
          scheduledTimeSeconds: scheduleTimeSeconds,
        };
      } catch (retryErr) {
        console.error(`[Cloud Tasks ❌] Re-try failed for '${sanitizedTaskId}':`, retryErr.message || retryErr);
      }
    }

    console.error(`[Cloud Tasks ❌] Failed to create Cloud Task '${sanitizedTaskId}':`, err.message || err);
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

/**
 * Deletes a scheduled task from Google Cloud Tasks by Task ID or full Task Name
 * 
 * @param {Object} params
 * @param {string} [params.taskId] - Task ID substring
 * @param {string} [params.taskName] - Full GCP Task Resource Name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteScheduledHttpTask({ taskId, taskName }) {
  try {
    const client = getCloudTasksClient();
    let fullTaskName = taskName;

    if (!fullTaskName && taskId) {
      const projectId = process.env.GCP_PROJECT_ID || "firstoption-8da25";
      const location = process.env.GCP_LOCATION || "asia-south1";
      const queueName = process.env.GCP_QUEUE_NAME || "whatsapp-automation-queue";
      const sanitizedTaskId = String(taskId).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 450);
      fullTaskName = client.taskPath(projectId, location, queueName, sanitizedTaskId);
    }

    if (!fullTaskName) {
      return { success: false, error: "Neither taskId nor taskName provided" };
    }

    console.log(`[Cloud Tasks 🗑️] Requesting deletion of task: ${fullTaskName}`);
    await client.deleteTask({ name: fullTaskName });
    console.log(`[Cloud Tasks ✅] Successfully deleted task: ${fullTaskName}`);

    return { success: true };
  } catch (err) {
    // 5 = NOT_FOUND in GCP gRPC / 404 in REST
    if (err.code === 5 || (err.message && err.message.includes("NOT_FOUND"))) {
      console.log(`[Cloud Tasks ℹ️] Task ${taskName || taskId} was already executed or deleted.`);
      return { success: true, alreadyDeleted: true };
    }
    console.error(`[Cloud Tasks ⚠️] Error deleting task ${taskName || taskId}:`, err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

async function listScheduledTasks() {
  try {
    const projectId = process.env.GCP_PROJECT_ID || "firstoption-8da25";
    const location = process.env.GCP_LOCATION || "asia-south1";
    const queueName = process.env.GCP_QUEUE_NAME || "whatsapp-automation-queue";

    const client = getCloudTasksClient();
    const parent = client.queuePath(projectId, location, queueName);

    const [tasks] = await client.listTasks({ parent, responseView: "FULL" });
    
    const formattedTasks = tasks.map((task) => {
      let payload = {};
      try {
        if (task.httpRequest && task.httpRequest.body) {
          let rawBody = task.httpRequest.body;
          if (Buffer.isBuffer(rawBody)) {
            rawBody = rawBody.toString("utf-8");
          } else if (typeof rawBody === "string") {
            try {
              const decoded = Buffer.from(rawBody, "base64").toString("utf-8");
              if (decoded.startsWith("{")) rawBody = decoded;
            } catch (e) {}
          }
          payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
        }
      } catch (e) {}

      const rawTaskId = payload.taskId || task.name.split("/").pop() || "";
      
      // Fallback parsing from task ID structure: task_PHONE_RULEID_MEETINGKEY_TIMESTAMP
      let extractedPhone = payload.leadPhone;
      if (!extractedPhone && rawTaskId.startsWith("task_")) {
        const parts = rawTaskId.split("_");
        if (parts.length >= 2 && parts[1].length >= 10) {
          extractedPhone = "+" + parts[1];
        }
      }

      return {
        name: task.name,
        taskId: rawTaskId,
        scheduleTimeSeconds: task.scheduleTime ? parseInt(task.scheduleTime.seconds, 10) : 0,
        leadPhone: extractedPhone || payload.leadPhone || "Unknown Phone",
        ruleTitle: payload.ruleTitle || (rawTaskId.includes("fallback") ? "Auto Funnel Welcome" : "Stage Automation Rule"),
        stageId: payload.stageId || "Active Pipeline Stage",
        payload: payload,
      };
    });

    formattedTasks.sort((a, b) => a.scheduleTimeSeconds - b.scheduleTimeSeconds);
    return { success: true, tasks: formattedTasks };
  } catch (err) {
    console.error(`[Cloud Tasks ⚠️] Error listing tasks:`, err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = {
  getCloudTasksClient,
  createScheduledHttpTask,
  deleteScheduledHttpTask,
  listScheduledTasks,
};

