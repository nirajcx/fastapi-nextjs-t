"use client";

import React, { useEffect, useState } from "react";
import {
  X, Check, Calendar, Download, ExternalLink,
  FileText, Image as ImageIcon, Clock, CheckCircle2, Circle
} from "lucide-react";
import type { Todo } from "@/lib/types";

interface TodoDetailModalProps {
  todo: Todo | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete?: (todo: Todo) => void;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(contentType?: string | null, fileName?: string | null): boolean {
  if (contentType?.startsWith("image/")) return true;
  if (!fileName) return false;
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(fileName);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function ImageAttachmentPreview({
  url,
  name,
  size,
  contentType,
}: {
  url: string;
  name?: string | null;
  size?: number | null;
  contentType?: string | null;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="todo-modal-image-wrapper">
      {!imageLoaded && !imageError && (
        <div className="image-loading-placeholder">
          <span className="loading-spinner" />
          <span>Loading image…</span>
        </div>
      )}

      {imageError ? (
        <div className="image-error-placeholder">
          <p>Unable to load image preview.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-action-btn"
          >
            <ExternalLink size={13} />
            Try opening in new tab
          </a>
        </div>
      ) : (
        <div className="image-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name ?? "Task attachment"}
            className={`modal-preview-img ${imageLoaded ? "modal-preview-img--loaded" : ""}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Image info bar and action buttons */}
      <div className="attachment-info-bar">
        <div className="attachment-info-text">
          <span className="attachment-info-name">
            {name ?? "Attached Image"}
          </span>
          {size != null && (
            <span className="attachment-info-meta">
              {formatBytes(size)}
              {contentType ? ` • ${contentType}` : ""}
            </span>
          )}
        </div>

        <div className="attachment-actions">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-action-btn"
            title="View image full size in new tab"
          >
            <ExternalLink size={13} />
            <span>Open full</span>
          </a>
          <a
            href={url}
            download={name ?? "attachment"}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-action-btn modal-action-btn--primary"
            title="Download image"
          >
            <Download size={13} />
            <span>Download</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function TodoDetailModal({
  todo,
  isOpen,
  onClose,
  onToggleComplete,
}: TodoDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !todo) return null;

  const hasAttachment = Boolean(todo.attachment_key || todo.attachment_url);
  const isImg = isImageAttachment(todo.attachment_content_type, todo.attachment_name);

  return (
    <div
      className="todo-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="todo-modal-title"
    >
      <div className="todo-modal-container">
        {/* Header */}
        <div className="todo-modal-header">
          <div className="todo-modal-status-badge">
            {todo.is_completed ? (
              <span className="status-pill status-pill--completed">
                <CheckCircle2 size={13} />
                Completed
              </span>
            ) : (
              <span className="status-pill status-pill--active">
                <Clock size={13} />
                In Progress
              </span>
            )}
            <span className="todo-modal-eyebrow">TASK DETAILS</span>
          </div>

          <button
            type="button"
            className="todo-modal-close"
            onClick={onClose}
            aria-label="Close details"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="todo-modal-body">
          {/* Title */}
          <h2
            id="todo-modal-title"
            className={`todo-modal-title ${todo.is_completed ? "todo-modal-title--completed" : ""}`}
          >
            {todo.title}
          </h2>

          {/* Description */}
          {todo.description ? (
            <div className="todo-modal-description">
              <p>{todo.description}</p>
            </div>
          ) : (
            <p className="todo-modal-no-desc">No description provided for this task.</p>
          )}

          {/* Image & Attachment Section */}
          {hasAttachment && (
            <div className="todo-modal-attachment-section">
              <div className="attachment-section-heading">
                {isImg ? <ImageIcon size={15} /> : <FileText size={15} />}
                <span>Attachment</span>
                {todo.attachment_size != null && (
                  <span className="attachment-filesize">
                    ({formatBytes(todo.attachment_size)})
                  </span>
                )}
              </div>

              {/* If it's an image */}
              {isImg && todo.attachment_url ? (
                <ImageAttachmentPreview
                  key={todo.attachment_url}
                  url={todo.attachment_url}
                  name={todo.attachment_name}
                  size={todo.attachment_size}
                  contentType={todo.attachment_content_type}
                />
              ) : todo.attachment_url ? (
                /* Non-image attachment file card */
                <div className="attachment-file-card">
                  <div className="file-card-details">
                    <div className="file-icon-box">
                      <FileText size={20} />
                    </div>
                    <div>
                      <strong className="file-card-name">
                        {todo.attachment_name ?? "Attached file"}
                      </strong>
                      <span className="file-card-meta">
                        {todo.attachment_size ? formatBytes(todo.attachment_size) : "File attachment"}
                        {todo.attachment_content_type ? ` • ${todo.attachment_content_type}` : ""}
                      </span>
                    </div>
                  </div>
                  <a
                    href={todo.attachment_url}
                    download={todo.attachment_name ?? "attachment"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-action-btn modal-action-btn--primary"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                </div>
              ) : null}
            </div>
          )}

          {/* Meta timestamps */}
          <div className="todo-modal-timestamps">
            <div className="timestamp-item">
              <Calendar size={13} />
              <span>Created {formatDate(todo.created_at)}</span>
            </div>
            {todo.updated_at && todo.updated_at !== todo.created_at && (
              <div className="timestamp-item">
                <Clock size={13} />
                <span>Updated {formatDate(todo.updated_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="todo-modal-footer">
          {onToggleComplete && (
            <button
              type="button"
              className={`modal-toggle-btn ${todo.is_completed ? "modal-toggle-btn--completed" : ""}`}
              onClick={() => onToggleComplete(todo)}
            >
              {todo.is_completed ? (
                <>
                  <Circle size={15} />
                  <span>Mark as Incomplete</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Mark as Complete</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Scoped CSS for the modal */}
      <style>{`
        .todo-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(18, 30, 24, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .todo-modal-container {
          background: #ffffff;
          border: 1px solid #dfe5db;
          border-radius: 18px;
          width: 100%;
          max-width: 620px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 60px -12px rgba(18, 38, 26, 0.3), 0 0 1px 1px rgba(0, 0, 0, 0.05);
          animation: modalScaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @keyframes modalScaleUp {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .todo-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid #edf0ea;
        }

        .todo-modal-status-badge {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 12px;
          letter-spacing: 0.2px;
        }

        .status-pill--completed {
          background: #eaf3e8;
          color: #2e6642;
          border: 1px solid #c7e0c4;
        }

        .status-pill--active {
          background: #f7f3e8;
          color: #7d652b;
          border: 1px solid #e8dec1;
        }

        .todo-modal-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #8c9688;
        }

        .todo-modal-close {
          background: transparent;
          border: none;
          color: #7b8577;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }

        .todo-modal-close:hover {
          background: #eff2eb;
          color: #273c34;
        }

        .todo-modal-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .todo-modal-title {
          font-family: Georgia, serif;
          font-size: 22px;
          font-weight: 500;
          line-height: 1.3;
          color: #1f3529;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .todo-modal-title--completed {
          text-decoration: line-through;
          color: #849182;
        }

        .todo-modal-description {
          background: #fbfbf9;
          border: 1px solid #ebefe8;
          border-radius: 10px;
          padding: 14px 16px;
        }

        .todo-modal-description p {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.65;
          color: #445648;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .todo-modal-no-desc {
          margin: 0;
          font-size: 13px;
          color: #8a9686;
          font-style: italic;
        }

        .todo-modal-attachment-section {
          background: #f7f9f5;
          border: 1px solid #e1e7dc;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .attachment-section-heading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #3b5f47;
          letter-spacing: 0.3px;
        }

        .attachment-filesize {
          font-size: 11px;
          font-weight: 400;
          color: #7b8e7e;
        }

        .todo-modal-image-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .image-frame {
          background: #0f1813;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d2dcd0;
          max-height: 400px;
        }

        .modal-preview-img {
          max-width: 100%;
          max-height: 400px;
          width: auto;
          height: auto;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .modal-preview-img--loaded {
          opacity: 1;
        }

        .image-loading-placeholder, .image-error-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 20px;
          background: #f0f4ee;
          border-radius: 10px;
          color: #6a7c6e;
          font-size: 12px;
        }

        .loading-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid #ccd8ca;
          border-top-color: #315e4b;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .attachment-info-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 4px;
        }

        .attachment-info-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .attachment-info-name {
          font-size: 12px;
          font-weight: 500;
          color: #273c34;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }

        .attachment-info-meta {
          font-size: 11px;
          color: #7d8b7b;
        }

        .attachment-actions {
          display: flex;
          gap: 8px;
        }

        .modal-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #ffffff;
          border: 1px solid #ced8cb;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 500;
          color: #315e4b;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }

        .modal-action-btn:hover {
          background: #eaf1e7;
          border-color: #a8beaa;
        }

        .modal-action-btn--primary {
          background: #315e4b;
          border-color: #315e4b;
          color: #ffffff;
        }

        .modal-action-btn--primary:hover {
          background: #24493a;
          border-color: #24493a;
        }

        .attachment-file-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #ffffff;
          border: 1px solid #d8e2d4;
          border-radius: 10px;
          padding: 12px 14px;
        }

        .file-card-details {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .file-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #eaf1e8;
          color: #345c47;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .file-card-name {
          display: block;
          font-size: 12.5px;
          color: #273c34;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 250px;
        }

        .file-card-meta {
          display: block;
          font-size: 11px;
          color: #7d8b7b;
        }

        .todo-modal-timestamps {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          padding-top: 4px;
          border-top: 1px solid #edf0ea;
        }

        .timestamp-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #828e80;
        }

        .todo-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          background: #fafbf9;
          border-top: 1px solid #edf0ea;
        }

        .modal-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 500;
          background: #e9f2e7;
          border: 1px solid #c9dcc6;
          color: #2d5a3f;
          cursor: pointer;
          transition: background 0.15s;
        }

        .modal-toggle-btn:hover {
          background: #d9e9d6;
        }

        .modal-toggle-btn--completed {
          background: #f4f5f1;
          border-color: #dbe0d7;
          color: #6a7667;
        }

        .modal-toggle-btn--completed:hover {
          background: #e9ede5;
        }

        .modal-close-btn {
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 500;
          background: #ffffff;
          border: 1px solid #d5ded1;
          color: #51604f;
          cursor: pointer;
          transition: background 0.15s;
        }

        .modal-close-btn:hover {
          background: #f0f3ed;
        }
      `}</style>
    </div>
  );
}
