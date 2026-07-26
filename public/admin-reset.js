const tokenInput = document.querySelector("#admin-token");
const issueButton = document.querySelector("#issue-challenge");
const confirmationStep = document.querySelector("#confirmation-step");
const confirmationText = document.querySelector("#confirmation-text");
const confirmationInput = document.querySelector("#confirmation-input");
const impactConfirmation = document.querySelector("#impact-confirmation");
const executeButton = document.querySelector("#execute-reset");
const expiryOutput = document.querySelector("#challenge-expiry");
const statusOutput = document.querySelector("#reset-status");
const summaryRecords = document.querySelector("#summary-records");
const summaryTrees = document.querySelector("#summary-trees");
const summarySessions = document.querySelector("#summary-sessions");
const summaryQueue = document.querySelector("#summary-queue");

let challenge = null;
let expiryTimer = null;

function setStatus(message, state = "") {
  statusOutput.textContent = message;
  statusOutput.dataset.state = state;
}

function resetChallenge() {
  challenge = null;
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  confirmationStep.hidden = true;
  confirmationInput.value = "";
  impactConfirmation.checked = false;
  executeButton.disabled = true;
}

function updateExecuteState() {
  executeButton.disabled =
    !challenge ||
    Date.now() >= challenge.expiresAt ||
    !impactConfirmation.checked ||
    confirmationInput.value !== challenge.confirmation;
}

async function adminRequest(path, body) {
  const token = tokenInput.value.trim();
  if (token.length < 32) {
    throw new Error("32文字以上の管理トークンを入力してください。");
  }
  const response = await fetch(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code;
    const messages = {
      admin_reset_disabled:
        "サーバーで管理リセットが有効になっていません。",
      admin_unauthorized: "管理トークンが一致しません。",
      admin_challenge_rate_limited:
        "確認コードの再発行まで少し待ってください。",
      reset_challenge_expired:
        "確認コードの有効期限が切れました。もう一度発行してください。",
      reset_confirmation_mismatch:
        "確認文が一致しません。確認コードを再発行してください。",
    };
    throw new Error(messages[code] || "管理操作を完了できませんでした。");
  }
  return payload;
}

issueButton.addEventListener("click", async () => {
  issueButton.disabled = true;
  resetChallenge();
  setStatus("削除対象を確認しています。");
  try {
    const payload = await adminRequest("/api/admin/reset/challenge", {});
    const measurements = payload.summary.measurements;
    const controllers = payload.summary.controllers;
    challenge = {
      id: payload.challengeId,
      confirmation: payload.confirmation,
      expiresAt: Date.parse(payload.expiresAt),
    };
    summaryRecords.textContent = String(measurements.records);
    summaryTrees.textContent = String(measurements.treeNodes);
    summarySessions.textContent = String(controllers.activeSessions);
    summaryQueue.textContent = String(
      measurements.queue.active + measurements.queue.waiting,
    );
    confirmationText.textContent = challenge.confirmation;
    expiryOutput.dateTime = payload.expiresAt;
    expiryOutput.textContent = new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(challenge.expiresAt));
    confirmationStep.hidden = false;
    confirmationInput.focus();
    expiryTimer = setTimeout(() => {
      executeButton.disabled = true;
      setStatus(
        "確認コードの有効期限が切れました。もう一度発行してください。",
        "error",
      );
    }, Math.max(0, challenge.expiresAt - Date.now()));
    setStatus(
      "削除はまだ実行されていません。最終確認を完了してください。",
    );
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    issueButton.disabled = false;
  }
});

for (const control of [confirmationInput, impactConfirmation]) {
  control.addEventListener("input", updateExecuteState);
}

executeButton.addEventListener("click", async () => {
  updateExecuteState();
  if (executeButton.disabled || !challenge) return;
  const accepted = window.confirm(
    "展示中の通信、木、紙飛行機をすべて消します。実行しますか？",
  );
  if (!accepted) return;

  executeButton.disabled = true;
  issueButton.disabled = true;
  setStatus("展示データを初期化しています。");
  try {
    const payload = await adminRequest("/api/admin/reset", {
      challengeId: challenge.id,
      confirmation: confirmationInput.value,
    });
    tokenInput.value = "";
    resetChallenge();
    setStatus(
      `初期化しました。リセットID: ${payload.resetId}`,
      "success",
    );
  } catch (error) {
    resetChallenge();
    setStatus(error.message, "error");
  } finally {
    issueButton.disabled = false;
  }
});
