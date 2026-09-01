import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Database as DatabaseIcon, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { formatError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import Pagination from "@/components/admin/Pagination";

export default function CollectionBrowser({ appId, section, fixedCollection, canEdit }) {
  const { t } = useTranslation();
  const base = `/apps/${appId}/sections/${section}`;
  const [collections, setCollections] = useState([]);
  const [connected, setConnected] = useState(true);
  const [selected, setSelected] = useState(fixedCollection || null);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [editingDoc, setEditingDoc] = useState(null);
  const [jsonDraft, setJsonDraft] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCollections = async () => {
    const res = await api.get(`${base}/collections`);
    setCollections(res.data.collections);
    setConnected(res.data.connected);
    if (!fixedCollection && !selected && res.data.collections.length) {
      setSelected(res.data.collections[0].name);
    }
  };

  const loadDocuments = async (coll, pageArg = page, limitArg = limit) => {
    if (!coll) return;
    const res = await api.get(`${base}/collections/${coll}/documents`, { params: { page: pageArg, limit: limitArg } });
    setDocuments(res.data.documents);
    setTotal(res.data.total);
  };

  useEffect(() => { loadCollections(); }, [appId, section]);
  useEffect(() => { setPage(1); }, [selected]);
  useEffect(() => { if (selected) loadDocuments(selected, page, limit); }, [selected, page, limit]);

  const openNew = () => {
    setEditingDoc(null);
    setJsonDraft("{\n  \n}");
    setDialogOpen(true);
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setJsonDraft(JSON.stringify(doc, null, 2));
    setDialogOpen(true);
  };

  const saveDoc = async () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch (e) {
      toast.error("JSON non valido / Invalid JSON");
      return;
    }
    try {
      if (editingDoc) {
        await api.put(`${base}/collections/${selected}/documents/${editingDoc._id}`, { data: parsed });
      } else {
        await api.post(`${base}/collections/${selected}/documents`, { data: parsed });
      }
      toast.success(t("common.success"));
      setDialogOpen(false);
      loadDocuments(selected);
      loadCollections();
    } catch (e) {
      toast.error(formatError(e, t("common.error")));
    }
  };

  const deleteDoc = async (doc) => {
    await api.delete(`${base}/collections/${selected}/documents/${doc._id}`);
    loadDocuments(selected);
    loadCollections();
  };

  if (!connected) {
    return <p className="text-sm text-muted-foreground" data-testid="db-not-connected">{t("app_pages.no_connection")}</p>;
  }

  const columns = documents.length ? Object.keys(documents[0]).slice(0, 5) : [];

  return (
    <div data-testid="collection-browser">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!fixedCollection && collections.map((c) => (
          <button
            key={c.name}
            onClick={() => setSelected(c.name)}
            data-testid={`collection-tab-${c.name}`}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              selected === c.name ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
            }`}
          >
            <DatabaseIcon className="h-3 w-3" /> {c.name} <Badge variant="outline" className="rounded-sm text-[10px]">{c.count}</Badge>
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="rounded-sm gap-1.5" onClick={() => selected && loadDocuments(selected)} data-testid="refresh-docs-btn">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {canEdit && (
            <Button size="sm" className="rounded-sm gap-1.5" onClick={openNew} data-testid="new-document-btn">
              <Plus className="h-3.5 w-3.5" /> {t("app_pages.new_document")}
            </Button>
          )}
        </div>
      </div>

      {!selected || documents.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="no-documents-text">{t("common.no_data")}</p>
      ) : (
        <div className="border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c} className="font-mono text-xs">{c}</TableHead>)}
                <TableHead className="text-right text-xs">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc._id} data-testid={`document-row-${doc._id}`}>
                  {columns.map((c) => (
                    <TableCell key={c} className="font-mono text-xs max-w-[220px] truncate">
                      {typeof doc[c] === "object" ? JSON.stringify(doc[c]) : String(doc[c] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(doc)} data-testid={`edit-doc-${doc._id}`}><Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /></button>
                          <ConfirmDeleteButton
                            testId={`delete-doc-${doc._id}`}
                            description={t("app_pages.delete_document_confirm")}
                            onConfirm={() => deleteDoc(doc)}
                          >
                            <button><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                          </ConfirmDeleteButton>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="p-2 text-xs text-muted-foreground">{documents.length} / {total}</p>
        </div>
      )}

      {selected && total > 0 && (
        <Pagination
          page={page} totalPages={Math.max(1, Math.ceil(total / limit))} onPageChange={setPage}
          pageSize={limit} onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[43.2rem]" data-testid="doc-editor-dialog">
          <DialogHeader><DialogTitle>{editingDoc ? t("app_pages.edit_document") : t("app_pages.new_document")}</DialogTitle></DialogHeader>
          <Textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            className="min-h-[260px] font-mono text-xs"
            data-testid="doc-json-editor"
          />
          <DialogFooter>
            <Button onClick={saveDoc} className="rounded-sm" data-testid="save-doc-btn">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
