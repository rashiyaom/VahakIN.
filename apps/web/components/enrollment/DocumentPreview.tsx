"use client";
import { useState } from "react";
import type { EnrollmentDocument } from "@/lib/enrollment/types";
import { documentLabels } from "@/lib/enrollment/policy";

export function DocumentPreview({ document: doc }: { document: EnrollmentDocument }) {
  const [failed, setFailed] = useState(false);
  const url = `/api/applications/documents/${doc.id}`;
  return <section style={{ border: "1px solid var(--border, #d4d4d4)", borderRadius: 12, padding: 16, marginBlock: 12 }}>
    <h4>{documentLabels[doc.kind]}</h4><p>{doc.name} · {Math.max(1, Math.round(doc.size / 1024))} KB</p>
    {doc.mime.startsWith("image/") && !failed ? <a href={`${url}?preview=1`} target="_blank" rel="noreferrer" aria-label={`Open full-size ${documentLabels[doc.kind]}`}><img src={`${url}?preview=1`} alt={documentLabels[doc.kind]} onError={() => setFailed(true)} style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "contain", background: "#f5f5f5", borderRadius: 8 }}/></a> : doc.mime === "application/pdf" ? <details><summary>Preview PDF</summary><iframe title={documentLabels[doc.kind]} src={`${url}?preview=1`} style={{ width: "100%", height: 480, border: 0 }}/></details> : null}
    {failed && <p role="status">Preview unavailable. Use the download link to inspect this file.</p>}
    <a href={url}>Download {documentLabels[doc.kind]}</a>
  </section>;
}
