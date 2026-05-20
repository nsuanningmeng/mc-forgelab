// ProviderForm — inline form to create or edit an AI provider
window.MCFL = window.MCFL || {};
(function () {
  const { useState } = React;
  const { cx, Icon } = window.MCFL;

  // Mode: "create" or "edit"
  function ProviderForm({ t, initial, mode = "create", onSave, onCancel }) {
    const tf = t.settings.providers;
    const [form, setForm] = useState({
      displayName: (initial && initial.displayName) || "",
      baseUrl: (initial && initial.baseUrl) || "https://api.openai.com/v1",
      apiKey: "",
      defaultModel: (initial && initial.defaultModel) || "gpt-4o-mini",
      timeoutMs: (initial && initial.timeoutMs) || 60000,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        // On edit, omit apiKey when empty to keep stored value.
        const payload = { ...form };
        if (mode === "edit" && payload.apiKey.length === 0) delete payload.apiKey;
        await onSave(payload);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setSubmitting(false);
      }
    };

    const field = (key, label, opts = {}) => {
      const inputId = `pf-${key}`;
      return (
        <div className={opts.full ? "md:col-span-2" : ""}>
          <label htmlFor={inputId} className={cx.label}>{label}</label>
          <input
            id={inputId}
            name={key}
            data-testid={`provider-${key}`}
            type={opts.type || "text"}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: opts.type === "number" ? Number(e.target.value) : e.target.value }))}
            placeholder={opts.placeholder}
            required={opts.required}
            autoComplete={opts.type === "password" ? "new-password" : "off"}
            className={cx.j(cx.input, opts.mono ? cx.mono : "")}
          />
          {opts.hint && <p className="text-2xs text-tx3 mt-1">{opts.hint}</p>}
        </div>
      );
    };

    return (
      <form onSubmit={submit} className={cx.j(cx.card, "p-4 grid grid-cols-1 md:grid-cols-2 gap-3")}>
        {field("displayName", tf.fields.displayName, { required: true, placeholder: "OpenAI · 主用", full: true })}
        {field("baseUrl", tf.fields.baseUrl, { required: true, placeholder: "https://api.openai.com/v1", mono: true })}
        {field("defaultModel", tf.fields.defaultModel, { required: true, placeholder: "gpt-4o-mini", mono: true })}
        {field("apiKey", tf.fields.apiKey, {
          type: "password",
          placeholder: tf.keyPlaceholder,
          required: mode === "create",
          hint: tf.keyHint,
          full: true,
        })}
        {field("timeoutMs", tf.fields.timeoutMs, { type: "number" })}

        {error && (
          <div className="md:col-span-2 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2 flex items-start gap-2">
            <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={cx.btnGhost}>{tf.cancel}</button>
          <button data-testid="provider-save-btn" type="submit" disabled={submitting} className={cx.btnPrimary}>
            {submitting ? tf.saving : tf.save}
          </button>
        </div>
      </form>
    );
  }

  window.MCFL.ProviderForm = ProviderForm;
})();
