const FINANCE_MAIL_SYSTEM_TOPOLOGY_MERMAID = `
flowchart TD
  subgraph External["External systems"]
    SourceSheet["Source Google Sheet<br/>DailyReports"]
    TargetSheet["Target Google Sheet<br/>Today finance report"]
    BackupSheet["Backup Google Sheet<br/>Raw reports"]
    OpenAI["OpenAI Responses API"]
    Gmail["Gmail / MailApp"]
    PaidForm["Paid subscriber form sheet<br/>Form Responses 1"]
    FreeForm["Free subscriber sheet"]
    CancelForm["Free unsubscribe response sheet"]
    LogSheet["Mail log sheet"]
    VariablesSheet["Variables sheet"]
  end

  subgraph Transfer["Report transfer pipeline"]
    TransferTrigger["Time trigger<br/>transferLatestDailyReportAndTrashSource"]
    Lock["Script lock"]
    WeekendGuard["Weekend guard"]
    Backup["backupRecentDailyReportsAndPruneSource_"]
    Cleanup["cleanupInvalidTargetReportRows_"]
    ActiveSlot["getActiveDailyReportSlot_"]
    FindReport["findLatestDailyAiReport_"]
    DuplicateCheck["isDailyReportAlreadyTransferred_"]
    EmptyReportGuard["hasTransferableDailyAiReport_"]
    BuildHtml["buildEmailHtmlFromAiReport_"]
    SanitizeHtml["sanitizeEmailHtmlOutput_"]
    WriteTarget["writeDailyAiReportToTarget_"]
  end

  subgraph Mailing["Mailing pipeline"]
    PaidEntry["sendPaidSubscriptionFinanceReportsNow"]
    FreeEntry["sendFreeMiddayFinanceReport"]
    PaidSlots["sendAvailablePaidSubscriptionReports_<br/>morning / midday / evening"]
    AudienceSend["sendFinanceReportByAudience_"]
    PreparePaid["prepareTodayPaidMailReport_"]
    PrepareFree["prepareTodayFreeMailReport_"]
    SelectReport["getTodayReportBySlotPredicate_"]
    PaidRecipients["getActivePaidSubscribersForMail_"]
    FreeRecipients["getActiveFreeSubscribersForMail_"]
    SentMap["getSentMap_"]
    Batch["groupRecipientsForAudienceBatch_<br/>chunkRecipients_"]
    SendBatch["sendAudienceBatch_"]
    BuildMailHtml["buildAudienceFinanceReportHtml_"]
    AppendLog["appendLog_"]
    MarkSent["markMailReportSent_"]
  end

  subgraph SetupAndMaintenance["Setup, cleanup, testing"]
    Setup["setupFinanceMailSystem"]
    CleanupEntry["cleanupInvalidDailyReportRows"]
    TestMail["sendTestFinanceReportToMyself"]
    PlaceholderDisabled["ensureNextBusinessDayReportRow_<br/>disabled"]
  end

  TransferTrigger --> Lock --> WeekendGuard
  WeekendGuard -- weekend --> Cleanup
  WeekendGuard -- business day --> Backup
  SourceSheet --> Backup --> BackupSheet
  Backup --> Cleanup --> ActiveSlot --> FindReport
  SourceSheet --> FindReport
  FindReport -- no report --> StopNoReport["Return without writing target row<br/>and without OpenAI API"]
  FindReport -- report found --> DuplicateCheck
  DuplicateCheck -- already transferred --> StopDuplicate["Return without OpenAI API"]
  DuplicateCheck -- new report --> EmptyReportGuard
  EmptyReportGuard -- empty ai_report --> StopEmpty["Return without OpenAI API"]
  EmptyReportGuard -- has ai_report --> BuildHtml
  BuildHtml --> OpenAI --> SanitizeHtml --> WriteTarget --> TargetSheet

  PaidEntry --> PaidSlots --> AudienceSend
  FreeEntry --> AudienceSend
  AudienceSend --> VariablesSheet
  AudienceSend -- paid --> PreparePaid
  AudienceSend -- free --> PrepareFree
  PreparePaid --> SelectReport
  PrepareFree --> SelectReport
  TargetSheet --> SelectReport
  AudienceSend -- paid --> PaidRecipients
  AudienceSend -- free --> FreeRecipients
  PaidForm --> PaidRecipients
  FreeForm --> FreeRecipients
  CancelForm --> FreeRecipients
  AudienceSend --> SentMap
  LogSheet --> SentMap
  SentMap --> Batch --> SendBatch
  SendBatch --> BuildMailHtml
  SendBatch --> Gmail
  SendBatch --> AppendLog --> LogSheet
  SendBatch --> MarkSent --> TargetSheet

  Setup --> VariablesSheet
  Setup --> LogSheet
  Setup --> PlaceholderDisabled
  TestMail --> TargetSheet
  TestMail --> Gmail
  CleanupEntry --> Cleanup --> TargetSheet
`;

function getFinanceMailSystemTopologyMermaid() {
  return FINANCE_MAIL_SYSTEM_TOPOLOGY_MERMAID.trim();
}
