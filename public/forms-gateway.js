/**
 * CarAudioGigant Forms Gateway — storefront helper (hardened)
 *
 * Security model:
 * - Calls ONLY shop-relative /apps/forms/* (Shopify app proxy HMAC).
 * - Bootstraps a short-lived session via /apps/forms/session first.
 * - Session token stays in closure memory (not window / localStorage).
 * - Mutating calls send X-Forms-Gateway + X-Forms-Gateway-Session.
 * - Direct app-host / curl / casual console submit without bootstrap → 401.
 */
(function (global) {
  "use strict";

  var SESSION_PATH = "/apps/forms/session";
  var STAGED_PATH = "/apps/forms/staged-upload";
  var SUBMIT_PATH = "/apps/forms/submit";

  var sessionToken = null;
  var sessionExpiresAt = 0;

  function proxyUrl(path) {
    return path;
  }

  function gatewayHeaders(extra) {
    var headers = {
      Accept: "application/json",
      "X-Forms-Gateway": "1",
    };
    if (sessionToken) {
      headers["X-Forms-Gateway-Session"] = sessionToken;
    }
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          headers[key] = extra[key];
        }
      }
    }
    return headers;
  }

  function sessionValid() {
    return (
      !!sessionToken &&
      sessionExpiresAt * 1000 > Date.now() + 15 * 1000
    );
  }

  async function ensureSession(force) {
    if (!force && sessionValid()) return;

    var response = await fetch(proxyUrl(SESSION_PATH), {
      method: "GET",
      headers: { Accept: "application/json", "X-Forms-Gateway": "1" },
      credentials: "same-origin",
      cache: "no-store",
    });

    var data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !data.ok || !data.sessionToken) {
      sessionToken = null;
      sessionExpiresAt = 0;
      throw new Error(data.error || "Unable to start secure form session");
    }

    sessionToken = data.sessionToken;
    sessionExpiresAt = data.expiresAt || 0;
  }

  function collectFields(form) {
    var fields = {};
    var formData = new FormData(form);
    formData.forEach(function (value, key) {
      if (value instanceof File) return;
      if (key === "form_key") return;
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        fields[key] = [].concat(fields[key], value);
      } else {
        fields[key] = value;
      }
    });

    Object.keys(fields).forEach(function (key) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key].join(", ");
      } else {
        fields[key] = String(fields[key]);
      }
    });

    return fields;
  }

  function fileInputs(form) {
    return Array.prototype.slice.call(
      form.querySelectorAll('input[type="file"]'),
    );
  }

  function collectFiles(form) {
    var files = [];
    fileInputs(form).forEach(function (input) {
      var fieldName = input.name || "file";
      Array.prototype.forEach.call(input.files || [], function (file) {
        files.push({ fieldName: fieldName, file: file });
      });
    });
    return files;
  }

  async function requestStagedTarget(file, retried) {
    await ensureSession(false);
    var response = await fetch(proxyUrl(STAGED_PATH), {
      method: "POST",
      headers: gatewayHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        httpMethod: "POST",
      }),
      credentials: "same-origin",
    });

    var data = await response.json().catch(function () {
      return {};
    });
    if (response.status === 401 && !retried) {
      await ensureSession(true);
      return requestStagedTarget(file, true);
    }
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to create staged upload");
    }
    return data;
  }

  async function uploadToStaged(target, file) {
    var formData = new FormData();
    (target.parameters || []).forEach(function (param) {
      formData.append(param.name, param.value);
    });
    formData.append("file", file);

    var response = await fetch(target.url, {
      method: target.httpMethod || "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("File upload failed (" + response.status + ")");
    }

    return target.resourceUrl;
  }

  async function submitForm(payload) {
    await ensureSession(false);
    var response = await fetch(proxyUrl(SUBMIT_PATH), {
      method: "POST",
      headers: gatewayHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });

    var data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Form submit failed");
    }

    sessionToken = null;
    sessionExpiresAt = 0;
    return data;
  }

  async function handleSubmit(form, event) {
    event.preventDefault();

    var formKeyInput = form.querySelector('[name="form_key"]');
    var formKey = formKeyInput && formKeyInput.value;
    if (!formKey) {
      throw new Error('Add a hidden input name="form_key" to identify this form');
    }

    var submitButtons = form.querySelectorAll(
      'button[type="submit"], input[type="submit"]',
    );
    submitButtons.forEach(function (btn) {
      btn.disabled = true;
    });

    try {
      await ensureSession(true);

      var fields = collectFields(form);
      var selected = collectFiles(form);
      var uploaded = [];

      for (var i = 0; i < selected.length; i++) {
        var item = selected[i];
        var target = await requestStagedTarget(item.file);
        var resourceUrl = await uploadToStaged(target, item.file);
        uploaded.push({
          fieldName: item.fieldName,
          filename: item.file.name,
          mimeType: item.file.type || "application/octet-stream",
          size: item.file.size,
          resourceUrl: resourceUrl,
        });
      }

      var result = await submitForm({
        form_key: formKey,
        fields: fields,
        files: uploaded,
      });

      form.dispatchEvent(
        new CustomEvent("forms-gateway:success", {
          detail: result,
          bubbles: true,
        }),
      );

      if (form.dataset.successRedirect) {
        window.location.href = form.dataset.successRedirect;
      } else if (!form.dataset.noReset) {
        form.reset();
        window.alert("Thanks — your form was submitted.");
      }

      return result;
    } catch (error) {
      form.dispatchEvent(
        new CustomEvent("forms-gateway:error", {
          detail: { error: error },
          bubbles: true,
        }),
      );
      window.alert(error.message || "Something went wrong. Please try again.");
      throw error;
    } finally {
      submitButtons.forEach(function (btn) {
        btn.disabled = false;
      });
    }
  }

  function bind(form) {
    if (!form || form.dataset.formsGatewayBound === "true") return form;
    form.dataset.formsGatewayBound = "true";
    form.addEventListener("submit", function (event) {
      handleSubmit(form, event);
    });
    ensureSession(false).catch(function () {});
    return form;
  }

  function autoBind() {
    document
      .querySelectorAll("form[data-forms-gateway]")
      .forEach(function (form) {
        bind(form);
      });
  }

  var api = {
    bind: bind,
    autoBind: autoBind,
  };

  global.FormsGateway = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoBind);
  } else {
    autoBind();
  }
})(typeof window !== "undefined" ? window : this);
