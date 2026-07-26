const executeButton = document.querySelector("#execute-reset");
const statusOutput = document.querySelector("#reset-status");

function setStatus(message, state = "") {
  statusOutput.textContent = message;
  statusOutput.dataset.state = state;
}

async function executeReset() {
  const response = await fetch("/api/admin/reset", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ confirmed: true }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const messages = {
      origin_not_allowed: "このページからリセットを実行できません。",
      invalid_reset_confirmation:
        "確認情報が正しくありません。ページを読み込み直してください。",
    };
    throw new Error(
      messages[payload?.error?.code] ||
        "展示データをまっさらにできませんでした。",
    );
  }
  return payload;
}

executeButton.addEventListener("click", async () => {
  const accepted = window.confirm(
    "これまでの通信記録、木の成長、参加中の紙飛行機をすべて消します。実行しますか？",
  );
  if (!accepted) {
    setStatus("リセットをキャンセルしました。");
    return;
  }

  executeButton.disabled = true;
  setStatus("展示データをまっさらにしています。");
  try {
    const payload = await executeReset();
    setStatus(
      `展示をまっさらにしました。リセットID: ${payload.resetId}`,
      "success",
    );
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    executeButton.disabled = false;
  }
});
