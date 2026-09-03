import DashboardLayout from "@/components/DashboardLayout";
import ReportEvidencePanel from "@/components/ReportEvidencePanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

function getNarrativePreview(value?: string | null) {
  try {
    const parsed = value
      ? (JSON.parse(value) as {
          sections?: Array<{
            title?: string;
            paragraphs?: string[];
            factRefs?: string[];
          }>;
        })
      : null;
    return parsed?.sections?.[0] ?? null;
  } catch {
    return null;
  }
}

export default function ReportStudio() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [summary, setSummary] = useState("");
  const [reviewedVersionId, setReviewedVersionId] = useState<number | null>(null);
  const [testPackageType, setTestPackageType] = useState<
    "basic" | "basic_plus"
  >("basic");
  const [testLanguage, setTestLanguage] = useState<"en" | "ru" | "de">("en");
  const queue = trpc.reportStudio.queue.useQuery();
  const processingSettings = trpc.reportStudio.processingSettings.useQuery();
  const detail = trpc.reportStudio.getJob.useQuery(
    { reportJobId: selectedJobId ?? 0 },
    { enabled: selectedJobId !== null }
  );
  const utils = trpc.useUtils();
  const reviseNarrative = trpc.reportStudio.reviseNarrative.useMutation({ onSuccess: () => { toast.success("A new PDF version is ready for review."); setReviewedVersionId(null); void utils.reportStudio.queue.invalidate(); void detail.refetch(); }, onError: error => toast.error(error.message) });
  const refreshQueue = () => void utils.reportStudio.queue.invalidate();
  const runCalculation = trpc.reportStudio.runCalculation.useMutation({
    onSuccess: () => {
      toast.success("PDF preview is ready for owner review.");
      refreshQueue();
      void detail.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const createTestJob = trpc.reportStudio.createTestJob.useMutation({
    onSuccess: result => {
      toast.success(
        "Synthetic test job created. It cannot be delivered to a client."
      );
      setSelectedJobId(result.jobId);
      refreshQueue();
    },
    onError: error => toast.error(error.message),
  });
  const deleteTestJob = trpc.reportStudio.deleteTestJob.useMutation({
    onSuccess: () => {
      toast.success("Synthetic test job and database artifacts removed.");
      setSelectedJobId(null);
      refreshQueue();
    },
    onError: error => toast.error(error.message),
  });
  const approve = trpc.reportStudio.approve.useMutation({
    onSuccess: () => {
      toast.success("Report approved and sent to the client by email.");
      refreshQueue();
      void detail.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const retryDelivery = trpc.reportStudio.retryDelivery.useMutation({
    onSuccess: () => {
      toast.success("Report delivery retry completed.");
      refreshQueue();
      void detail.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const updateProcessing =
    trpc.reportStudio.updateProcessingSettings.useMutation({
      onSuccess: () => {
        toast.success("Automatic processing setting saved.");
        void processingSettings.refetch();
      },
      onError: error => toast.error(error.message),
    });
  const saveSettings = (patch: {
    aiModel?: string;
    maxTokens?: number;
    maxSections?: number;
    maxParagraphChars?: number;
    autoProcessEnabled?: boolean;
  }) => {
    const current = processingSettings.data;
    if (!current) return;
    updateProcessing.mutate({
      autoProcessEnabled:
        patch.autoProcessEnabled ?? current.autoProcessEnabled,
      aiModel: (patch.aiModel ?? current.aiModel ?? "gpt-5-mini") as
        | "gpt-5-nano"
        | "gpt-5-mini"
        | "gpt-5"
        | "claude-haiku-4-5"
        | "claude-sonnet-4-6"
        | "gemini-3-flash-preview",
      maxTokens: patch.maxTokens ?? current.maxTokens ?? 5000,
      maxSections: patch.maxSections ?? current.maxSections ?? 6,
      maxParagraphChars:
        patch.maxParagraphChars ?? current.maxParagraphChars ?? 1800,
    });
  };
  const selectedVersion = detail.data?.versions?.[0];
  const isTestJob = Boolean(detail.data?.job?.testJob);
  const previewUrl = selectedVersion?.pdfStorageKey
    ? `/manus-storage/${selectedVersion.pdfStorageKey}`
    : null;
  const narrativePreview = getNarrativePreview(
    detail.data?.narrative?.narrativeJson
  );

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#f8f5f0] px-4 py-6 text-[#28231f] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a96346]">
                Report Studio · owner only
              </p>
              <h1 className="mt-2 font-serif text-4xl">
                Review & approve reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#635a52]">
                Verified payments create a queued job. Resolve birth location,
                run the deterministic calculation, inspect the PDF preview, then
                approve it before any client delivery.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs"
                onSubmit={event => {
                  event.preventDefault();
                  createTestJob.mutate({
                    packageType: testPackageType,
                    language: testLanguage,
                  });
                }}
              >
                <FlaskConical size={15} className="text-amber-700" />
                <span className="font-semibold text-amber-900">
                  Synthetic test
                </span>
                <label>
                  Package{" "}
                  <select
                    aria-label="Test package"
                    value={testPackageType}
                    onChange={event =>
                      setTestPackageType(
                        event.target.value as "basic" | "basic_plus"
                      )
                    }
                    className="ml-1 rounded border bg-white px-1 py-1"
                  >
                    <option value="basic">Basic</option>
                    <option value="basic_plus">Basic+</option>
                  </select>
                </label>
                <label>
                  Language{" "}
                  <select
                    aria-label="Test language"
                    value={testLanguage}
                    onChange={event =>
                      setTestLanguage(event.target.value as "en" | "ru" | "de")
                    }
                    className="ml-1 rounded border bg-white px-1 py-1"
                  >
                    <option value="en">EN</option>
                    <option value="ru">RU</option>
                    <option value="de">DE</option>
                  </select>
                </label>
                <Button
                  size="sm"
                  type="submit"
                  disabled={createTestJob.isPending}
                >
                  {createTestJob.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FlaskConical size={14} />
                  )}
                  Create test job
                </Button>
              </form>
              <div className="flex items-center gap-2 rounded-xl border border-[#28231f]/10 bg-white px-3 py-2 text-xs">
                <span>Auto-process new jobs</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    saveSettings({
                      autoProcessEnabled: !(
                        processingSettings.data?.autoProcessEnabled ?? false
                      ),
                    })
                  }
                  disabled={updateProcessing.isPending}
                >
                  {processingSettings.data?.autoProcessEnabled ? "ON" : "OFF"}
                </Button>
              </div>
              <Link href="/admin">
                <Button variant="outline">Back to admin</Button>
              </Link>
            </div>
          </div>
          {queue.error ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-5 text-sm text-red-800">
                This workspace is restricted to the account owner.{" "}
                {queue.error.message}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText size={18} />
                    Report queue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {queue.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[#635a52]">
                      <Loader2 className="animate-spin" size={16} />
                      Loading…
                    </div>
                  ) : !queue.data?.length ? (
                    <p className="text-sm text-[#635a52]">
                      No paid report jobs yet. Create a synthetic test job to
                      validate the full PDF workflow.
                    </p>
                  ) : (
                    queue.data.map(({ job, version }) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${selectedJobId === job.id ? "border-[#a96346] bg-[#fbf6ec]" : "border-[#28231f]/10 bg-white hover:border-[#a96346]/50"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            #{job.id} · booking #{job.bookingId}
                          </span>
                          <span className="rounded-full bg-[#efe4d5] px-2 py-1 text-[10px] font-bold uppercase">
                            {version?.status ?? job.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#635a52]">
                          {job.packageType} · {job.language} · attempt{" "}
                          {job.attemptCount}
                          {job.testJob ? " · SYNTHETIC TEST" : ""}
                        </p>
                        {job.lastErrorMessage && (
                          <p className="mt-2 text-xs text-red-700">
                            {job.lastErrorMessage}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
              <div className="space-y-6">
                {!selectedJobId || !detail.data ? (
                  <Card>
                    <CardContent className="p-8 text-sm text-[#635a52]">
                      Select a paid report job or create a synthetic test job to
                      begin review.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Calculation input confirmation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isTestJob && (
                          <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            This is a synthetic owner-only test with example.com
                            email. It cannot be approved or delivered to a
                            client.
                          </p>
                        )}
                        <p className="mb-4 text-sm text-[#635a52]">
                          Client: <strong>{detail.data.booking?.name}</strong> ·{" "}
                          {detail.data.booking?.birthDate}{" "}
                          {detail.data.booking?.birthTime} ·{" "}
                          {detail.data.booking?.birthCity},{" "}
                          {detail.data.booking?.birthCountry}
                        </p>
                        <p className="rounded-xl bg-[#fbf6ec] p-4 text-sm text-[#635a52]">
                          The worker automatically resolves the city,
                          coordinates, IANA timezone and DST offset using the
                          configured geocoding service.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Button
                            className="bg-[#a96346] text-white hover:bg-[#8f5037]"
                            onClick={() =>
                              runCalculation.mutate({
                                reportJobId: selectedJobId,
                              })
                            }
                            disabled={runCalculation.isPending}
                          >
                            <Play size={16} />
                            {runCalculation.isPending
                              ? "Resolving and calculating…"
                              : "Resolve location & render preview"}
                          </Button>
                          {isTestJob && (
                            <Button
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() =>
                                deleteTestJob.mutate({
                                  reportJobId: selectedJobId,
                                })
                              }
                              disabled={deleteTestJob.isPending}
                            >
                              <Trash2 size={16} />
                              {deleteTestJob.isPending
                                ? "Deleting…"
                                : "Delete synthetic test"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ShieldCheck size={18} />
                          Owner review
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReportEvidencePanel factsJson={detail.data.calculation?.factsJson} narrativeJson={detail.data.narrative?.narrativeJson} versions={detail.data.versions} saving={reviseNarrative.isPending} onRevise={selectedVersion?.status === "needs_review" ? narrativeJson => reviseNarrative.mutate({ reportJobId: selectedJobId, baseVersionId: selectedVersion.id, narrativeJson }) : undefined} />
                        {narrativePreview && (
                          <div className="mb-5 rounded-xl border border-[#d9a441]/40 bg-[#fffaf0] p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8d6d1f]">
                              AI narrative draft · validated facts only
                            </p>
                            <h3 className="mt-2 font-serif text-xl">
                              {narrativePreview.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-[#514a43]">
                              {narrativePreview.paragraphs?.[0]}
                            </p>
                            <p className="mt-2 text-[11px] text-[#8d7b6b]">
                              Fact references:{" "}
                              {narrativePreview.factRefs?.join(", ")}
                            </p>
                          </div>
                        )}
                        {previewUrl ? (
                          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                            <iframe
                              title="Report PDF preview"
                              src={previewUrl}
                              className="h-[720px] w-full rounded-xl border border-[#28231f]/15 bg-white"
                            />
                            <div className="space-y-4">
                              <div className="rounded-xl bg-[#fbf6ec] p-4 text-sm">
                                <p className="font-semibold">
                                  Version {selectedVersion?.versionNumber} ·{" "}
                                  {selectedVersion?.status}
                                </p>
                                <p className="mt-2 text-[#635a52]">
                                  Facts status:{" "}
                                  {detail.data.calculation?.validationStatus ??
                                    "not calculated"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-[#28231f]/20 px-3 py-1.5 text-xs font-semibold hover:bg-white"
                                  >
                                    Open PDF
                                  </a>
                                  <a
                                    href={previewUrl}
                                    download
                                    className="rounded-full border border-[#28231f]/20 px-3 py-1.5 text-xs font-semibold hover:bg-white"
                                  >
                                    Download PDF
                                  </a>
                                </div>
                              </div>
                              {!isTestJob && (
                                <>
                                  <div>
                                    <Label htmlFor="summary">
                                      Approval note
                                    </Label>
                                    <textarea
                                      id="summary"
                                      value={summary}
                                      onChange={e => setSummary(e.target.value)}
                                      className="mt-1 min-h-28 w-full rounded-xl border border-[#28231f]/15 bg-white p-3 text-sm"
                                      placeholder="Optional owner review note"
                                    />
                                  </div>
                                  <Button
                                    className="w-full bg-[#28231f] text-white hover:bg-[#403830]"
                                    onClick={() =>
                                      approve.mutate({
                                        reportJobId: selectedJobId,
                                        versionId: selectedVersion!.id,
                                        summary,
                                      })
                                    }
                                    disabled={
                                      approve.isPending ||
                                      reviewedVersionId !== selectedVersion?.id ||
                                      detail.data.calculation?.validationStatus !== "valid" ||
                                      selectedVersion?.status === "approved" ||
                                      selectedVersion?.status === "sent"
                                    }
                                  >
                                    {approve.isPending ? (
                                      "Approving and sending…"
                                    ) : selectedVersion?.status === "sent" ? (
                                      <>
                                        <CheckCircle2 size={16} />
                                        Delivered
                                      </>
                                    ) : selectedVersion?.status ===
                                      "approved" ? (
                                      <>
                                        <CheckCircle2 size={16} />
                                        Approved
                                      </>
                                    ) : (
                                      "Approve PDF for delivery"
                                    )}
                                  </Button>
                                  <label className="flex items-start gap-2 rounded-xl border border-[#28231f]/15 p-3 text-xs leading-5">
                                    <input type="checkbox" className="mt-1" checked={reviewedVersionId === selectedVersion?.id} onChange={event => setReviewedVersionId(event.target.checked ? selectedVersion!.id : null)} />
                                    <span>I checked the source facts, every PDF page and the recipient: <strong>{detail.data.booking?.email}</strong>. Approval sends this version by email.</span>
                                  </label>
                                  {detail.data.job?.status ===
                                    "delivery_failed" && (
                                    <Button
                                      className="w-full"
                                      variant="outline"
                                      onClick={() =>
                                        retryDelivery.mutate({
                                          reportJobId: selectedJobId,
                                          versionId: selectedVersion!.id,
                                        })
                                      }
                                      disabled={retryDelivery.isPending}
                                    >
                                      <RefreshCw size={16} />
                                      {retryDelivery.isPending
                                        ? "Retrying…"
                                        : "Retry failed delivery"}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-[#635a52]">
                            No PDF preview has been rendered for this job. Run
                            the automatic city geocoding and calculation step
                            first.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
