// centralized CSS matching existing dark glassmorphism design

export const STYLES = `
:root {
  --qol-bg: rgba(15, 23, 42, 0.9);
  --qol-bg-solid: #0f172a;
  --qol-bg-soft: rgba(15, 23, 42, 0.6);
  --qol-border: rgba(148, 163, 184, 0.35);
  --qol-border-soft: rgba(148, 163, 184, 0.25);
  --qol-text: #e5e7eb;
  --qol-text-soft: rgba(226, 232, 240, 0.75);
  --qol-accent: #6366f1;
  --qol-accent-soft: rgba(99, 102, 241, 0.35);
  --qol-radius-lg: 18px;
  --qol-radius-md: 14px;
  --qol-radius-sm: 10px;
  --qol-z: 2147483647;
}

[data-qol-ui] {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  color: var(--qol-text);
}

/* Toolbar */
#qol-toolbar {
  position: fixed;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--qol-bg);
  border: 1px solid var(--qol-border);
  border-radius: var(--qol-radius-md);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  z-index: var(--qol-z);
  color: inherit;
}

#qol-toolbar button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: var(--qol-bg-soft);
  color: inherit;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: var(--qol-radius-sm);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

#qol-toolbar button:hover {
  border-color: var(--qol-accent);
  background: rgba(15, 23, 42, 0.8);
}

#qol-toolbar button.qol-active {
  background: var(--qol-accent);
  border: none;
  color: #0f172a;
  font-weight: 600;
}

#qol-toolbar .qol-empty {
  padding: 4px;
  font-size: 11px;
  color: var(--qol-text-soft);
}

/* Modal */
#qol-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.65);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: calc(var(--qol-z) - 1);
}

#qol-mask.show {
  opacity: 1;
  pointer-events: auto;
}

#qol-modal {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(560px, calc(100% - 32px));
  max-height: min(90vh, 720px);
  background: var(--qol-bg-solid);
  border: 1px solid var(--qol-border);
  border-radius: var(--qol-radius-lg);
  box-shadow: 0 35px 90px rgba(15, 23, 42, 0.7);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: var(--qol-z);
}

#qol-modal.show {
  opacity: 1;
  transform: translateY(0);
}

.qol-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.qol-modal-header h2 {
  margin: 0;
  font-size: 20px;
}

.qol-modal-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--qol-text-soft);
}

.qol-close-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.qol-close-btn:hover {
  background: var(--qol-bg-soft);
}

.qol-modal-body {
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.qol-script-section {
  width: 100%;
}

.qol-script-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--qol-accent);
}

.qol-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.qol-form-group label {
  font-size: 13px;
  color: var(--qol-text);
}

.qol-form-group input[type="text"],
.qol-form-group input[type="color"],
.qol-form-group select,
.qol-form-group textarea {
  width: 100%;
  border-radius: var(--qol-radius-sm);
  border: 1px solid var(--qol-border-soft);
  background: var(--qol-bg-soft);
  color: var(--qol-text);
  padding: 8px 10px;
  font-size: 13px;
}

.qol-form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.qol-form-group.row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.qol-form-group.row input {
  width: auto;
}

.qol-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.qol-actions .primary {
  background: var(--qol-accent);
  border: none;
  color: #0f172a;
  font-weight: 600;
}

/* Toast */
#qol-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 12px;
  padding: 10px 16px;
  border: 1px solid var(--qol-border);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: var(--qol-z);
  pointer-events: none;
  max-width: min(400px, 80vw);
}

#qol-toast.show {
  opacity: 1;
  transform: translateY(0);
}

/* Ensure UI elements aren't affected by dark mode filters */
#qol-toolbar,
#qol-modal,
#qol-toast {
  filter: none !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
`;

