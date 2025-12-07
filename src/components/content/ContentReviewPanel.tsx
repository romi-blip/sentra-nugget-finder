import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Lightbulb, 
  RefreshCw, 
  Wand2,
  MessageSquarePlus,
  Loader2,
  FileUp
} from "lucide-react";
import { ReviewerFeedbackDialog } from "./ReviewerFeedbackDialog";
import { DocxReviewUploadDialog } from "./DocxReviewUploadDialog";

interface ContentReview {
  id: string;
  overall_score: number;
  status: string;
  review_result: {
    recommendation: string;
    summary: string;
    categories: {
      messaging: { score: number; notes: string };
      quality: { score: number; notes: string };
      accuracy: { score: number; notes: string };
      tone: { score: number; notes: string };
      seo: { score: number; notes: string };
    };
    issues: Array<{
      severity: string;
      category: string;
      description: string;
      location?: string;
      suggestion: string;
    }>;
    strengths: string[];
  };
  human_feedback?: string;
  feedback_applied?: boolean;
  created_at: string;
}

interface ProcessingResult {
  success: boolean;
  commentsProcessed: number;
  patternsCreated: number;
  revisionsApplied: boolean;
  originalContent?: string;
  revisedContent?: string;
  summary: {
    comments: Array<{ category: string; severity: string; issue: string; instruction: string }>;
    patternsAdded: Array<{ type: string; pattern: string }>;
  };
}

interface ContentReviewPanelProps {
  review: ContentReview | null;
  isLoading?: boolean;
  onRunReview: () => void;
  onApplyFeedback: () => void;
  onAddFeedback: (feedback: string) => void;
  isReviewing?: boolean;
  isApplying?: boolean;
  isAddingFeedback?: boolean;
  contentItemId: string;
  uploadDocxReview: (params: { contentItemId: string; file: File }) => Promise<ProcessingResult>;
  isUploadingDocx?: boolean;
  onDocxSuccess: () => void;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  major: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  suggestion: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const severityIcons: Record<string, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4" />,
  major: <AlertTriangle className="h-4 w-4" />,
  minor: <AlertTriangle className="h-4 w-4" />,
  suggestion: <Lightbulb className="h-4 w-4" />,
};

const recommendationColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  minor_revisions: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  major_revisions: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const categoryMaxScores: Record<string, number> = {
  messaging: 25,
  quality: 25,
  accuracy: 20,
  tone: 15,
  seo: 15,
};

export const ContentReviewPanel: React.FC<ContentReviewPanelProps> = ({
  review,
  isLoading,
  onRunReview,
  onApplyFeedback,
  onAddFeedback,
  isReviewing,
  isApplying,
  isAddingFeedback,
  contentItemId,
  uploadDocxReview,
  isUploadingDocx,
  onDocxSuccess,
}) => {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [docxUploadOpen, setDocxUploadOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No review available for this content.</p>
        <Button onClick={onRunReview} disabled={isReviewing}>
          {isReviewing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Reviewing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Review
            </>
          )}
        </Button>
      </div>
    );
  }

  const { review_result } = review;
  const hasIssues = review_result.issues && review_result.issues.length > 0;

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-6 pr-4">
        {/* Overall Score */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Score</h3>
            <p className="text-3xl font-bold">{review.overall_score}/100</p>
          </div>
          <Badge className={recommendationColors[review_result.recommendation]}>
            {review_result.recommendation.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Summary */}
        <div>
          <p className="text-sm text-muted-foreground">{review_result.summary}</p>
        </div>

        {/* Category Scores */}
        <div className="space-y-3">
          <h4 className="font-medium">Category Scores</h4>
          {Object.entries(review_result.categories).map(([category, data]) => {
            const maxScore = categoryMaxScores[category];
            const percentage = (data.score / maxScore) * 100;
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{category}</span>
                  <span>{data.score}/{maxScore}</span>
                </div>
                <Progress value={percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">{data.notes}</p>
              </div>
            );
          })}
        </div>

        {/* Strengths */}
        {review_result.strengths && review_result.strengths.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Strengths
            </h4>
            <ul className="text-sm space-y-1">
              {review_result.strengths.map((strength, i) => (
                <li key={i} className="text-muted-foreground">• {strength}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues */}
        {hasIssues && (
          <div className="space-y-3">
            <h4 className="font-medium">Issues ({review_result.issues.length})</h4>
            {review_result.issues.map((issue, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={severityColors[issue.severity]}>
                    {severityIcons[issue.severity]}
                    <span className="ml-1">{issue.severity}</span>
                  </Badge>
                  <span className="text-sm font-medium capitalize">{issue.category}</span>
                </div>
                {issue.location && (
                  <p className="text-xs text-muted-foreground">Location: {issue.location}</p>
                )}
                <p className="text-sm">{issue.description}</p>
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-xs font-medium text-muted-foreground">Suggestion:</p>
                  <p className="text-sm">{issue.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Human Feedback */}
        {review.human_feedback && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Human Reviewer Feedback</h4>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              {review.human_feedback}
            </p>
            {review.feedback_applied && (
              <Badge variant="outline" className="mt-2">
                <CheckCircle className="h-3 w-3 mr-1" />
                Pattern added to reviewer
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRunReview}
            disabled={isReviewing}
          >
            {isReviewing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-review
          </Button>
          
          {hasIssues && review.status !== 'revised' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onApplyFeedback}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Apply Suggestions
            </Button>
          )}
          
          {!review.feedback_applied && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFeedbackDialogOpen(true)}
              disabled={isAddingFeedback}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Add Feedback to Reviewer
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setDocxUploadOpen(true)}
            disabled={isUploadingDocx}
          >
            {isUploadingDocx ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4 mr-2" />
            )}
            Upload DOCX Review
          </Button>
        </div>
      </div>

      <ReviewerFeedbackDialog
        open={feedbackDialogOpen}
        onClose={() => setFeedbackDialogOpen(false)}
        onSubmit={(feedback) => {
          onAddFeedback(feedback);
          setFeedbackDialogOpen(false);
        }}
        isLoading={isAddingFeedback}
      />

      <DocxReviewUploadDialog
        open={docxUploadOpen}
        onClose={() => setDocxUploadOpen(false)}
        contentItemId={contentItemId}
        onSuccess={() => {
          // Don't close here - let the dialog handle its own closing after user reviews results
          onDocxSuccess();
        }}
        uploadDocxReview={uploadDocxReview}
        isUploading={isUploadingDocx || false}
      />
    </ScrollArea>
  );
};
