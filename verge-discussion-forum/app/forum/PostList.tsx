import Post from "./Post";
import { useDeleteComment, usePostComment, useReplies } from "./useComments";
import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import ReplyIcon from "@mui/icons-material/Reply";
import DeleteIcon from "@mui/icons-material/Delete";
import ForumIcon from "@mui/icons-material/Forum";
import TextField from "@mui/material/TextField";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import NewPostForm from "./NewPostForm";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { upvoteComment } from "./commentApi";
import UserLink from "../components/UserLink";
import Avatar from "@mui/material/Avatar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Linkify from "linkify-react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InstitutionEmailModal from "../components/InstitutionEmailModal";

interface Comment {
  id: number;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  replies?: Comment[];
  upvotes?: number;
  userFullName?: string;
}

interface PostListProps {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  postId?: number;
  staffPostId?: number;
  grantId?: number;
  targetId?: string; // NEW: Add targetId parameter
  userId: string;
}

function ReplyForm({
  parentId,
  onPost,
  postId,
  staffPostId,
  grantId,
  targetId, // NEW: Add targetId parameter
  userId,
}: {
  parentId: number;
  onPost: () => void;
  postId?: number;
  staffPostId?: number;
  grantId?: number;
  targetId?: string; // NEW: Add targetId parameter
  userId: string;
}) {
  // Remove author state and input
  // const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const { submit, loading, error, institutionEmailError } = usePostComment(
    postId,
    userId,
    onPost,
    staffPostId,
    grantId,
    targetId // NEW: Pass targetId to the hook
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("ReplyForm submit:", {
      postId,
      staffPostId,
      grantId,
      parentId,
      userId,
      content,
    });
    if (content.trim()) {
      await submit(content, parentId);
      setContent("");
      // setAuthor("");
    }
  };

  return (
    <>
      <Box
        sx={{ mt: 2, width: "100%", bgcolor: "#f5f5f5", borderRadius: 2, p: 2 }}
      >
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          {/* Remove name input */}
          <TextField
            label="Reply..."
            variant="outlined"
            multiline
            minRows={1}
            maxRows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
            sx={{ borderRadius: 3, mb: 1, width: "100%", fontSize: 14 }}
            InputProps={{ sx: { borderRadius: 3, fontSize: 14 } }}
            InputLabelProps={{ sx: { fontSize: 14 } }}
            inputProps={{ style: { resize: "none", fontSize: 14 } }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ borderRadius: 3, px: 3, py: 0.5, fontSize: 13 }}
          >
            {loading ? "Replying..." : "Reply"}
          </Button>
          {error && (
            <Typography color="error" sx={{ mt: 1, fontSize: 12 }}>
              {error}
            </Typography>
          )}
        </form>
      </Box>

      <InstitutionEmailModal
        open={institutionEmailError}
        onClose={() => {}} // The modal will be controlled by the hook
        action="post comments"
      />
    </>
  );
}

function CommentItem({
  comment,
  onDelete,
  onReply,
  replyingId,
  refresh,
  postId,
  staffPostId,
  grantId,
  targetId,
  onReplyPosted,
  isReply = false,
  onUpvote,
  upvoted,
  upvotes,
  userId,
}: {
  comment: Comment;
  onDelete: (id: number) => void;
  onReply: (id: number) => void;
  replyingId: number | null;
  refresh: () => void;
  postId?: number;
  staffPostId?: number;
  grantId?: number;
  targetId?: string;
  onReplyPosted: () => void;
  isReply?: boolean;
  onUpvote?: (id: number) => void;
  upvoted?: boolean;
  upvotes?: number;
  userId: string;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const { remove } = useDeleteComment(refresh, userId);

  // Use replies from the comment data instead of making separate API calls
  const replies = comment.replies || [];

  const handleShowReplies = () => setShowReplies((v) => !v);
  const handleReplyPost = () => {
    if (refresh) refresh();
  };
  const handleDelete = async (id: number) => {
    await remove(id);
    if (typeof refresh === "function") {
      refresh();
    }
  };

  // Extract first and last name from userFullName if available
  let firstName = "";
  let lastName = "";
  if (comment.userFullName) {
    const parts = comment.userFullName.split(" ");
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || "";
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        borderRadius: 3,
        boxShadow: 2,
        p: 1,
        mb: 1,
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        maxWidth: "100%",
        minWidth: 0,
        position: isReply ? "relative" : "static",
        ml: isReply ? 2 : 0,
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: isReply ? 22 : 28,
          height: isReply ? 22 : 28,
          bgcolor: "#1976d2",
          fontWeight: 700,
          fontSize: isReply ? 11 : 13,
          mr: 1,
          mt: 0.5,
        }}
      >
        {firstName && lastName
          ? `${firstName[0]}${lastName[0]}`.toUpperCase()
          : comment.userId[0].toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Name and (optional) delete icon */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.25 }}>
          <UserLink userId={comment.userId}>
            <Typography
              sx={{ fontWeight: 700, fontSize: 13, color: "#1976d2", mr: 1 }}
            >
              {comment.userFullName || comment.userId}
            </Typography>
          </UserLink>
          {comment.userId === userId && (
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(comment.id)}
              sx={{ ml: 0.5, p: 0.25 }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          )}
        </Box>
        {/* Comment text */}
        <Typography
          variant="body1"
          sx={{
            color: "#222",
            fontSize: 12.5,
            wordBreak: "break-word",
            whiteSpace: "pre-line",
            mb: 0.75,
            pl: 0.5,
          }}
        >
          <Linkify
            options={{
              target: "_blank",
              rel: "noopener noreferrer",
              className: undefined,
              attributes: {
                style: {
                  color: "#1976d2",
                  textDecoration: "underline",
                  wordBreak: "break-all",
                },
              },
            }}
          >
            {comment.content}
          </Linkify>
        </Typography>
        {/* Actions row */}
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.25 }}>
          {!isReply && (
            <Button
              size="small"
              startIcon={<ReplyIcon fontSize="inherit" />}
              onClick={() => onReply(comment.id)}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "#1976d2",
                px: 0.5,
                py: 0.25,
                borderRadius: 2,
                fontSize: 11,
                minWidth: 0,
              }}
            >
              Reply
            </Button>
          )}
          {!isReply && replies.length > 0 && (
            <Button
              size="small"
              onClick={handleShowReplies}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: "#1976d2",
                px: 0.5,
                py: 0.25,
                borderRadius: 2,
                fontSize: 11,
                minWidth: 0,
              }}
            >
              {showReplies
                ? "Hide Replies"
                : `Show Replies (${replies.length})`}
            </Button>
          )}
          {/* Upvote for top-level comments only */}
          {!isReply && (
            <Box sx={{ display: "flex", alignItems: "center", ml: 1 }}>
              <IconButton
                size="small"
                color={upvoted ? "primary" : "default"}
                onClick={() => onUpvote && onUpvote(comment.id)}
                disabled={upvoted}
                sx={{ p: 0.25 }}
              >
                <ThumbUpIcon fontSize="inherit" />
              </IconButton>
              <Typography sx={{ fontSize: 10, ml: 0.5 }}>
                {upvotes ?? 0}
              </Typography>
            </Box>
          )}
        </Box>
        {/* Reply form (if replying) */}
        {!isReply && replyingId === comment.id && (
          <ReplyForm
            parentId={comment.id}
            onPost={() => {
              handleReplyPost();
              if (onReplyPosted) onReplyPosted();
            }}
            postId={postId}
            staffPostId={staffPostId}
            grantId={grantId}
            targetId={targetId}
            userId={userId}
          />
        )}
        {/* Replies (if shown) */}
        {!isReply && showReplies && (
          <Box sx={{ ml: 2, mt: 1 }}>
            {replies.length === 0 && (
              <Typography fontSize={12}>No replies yet.</Typography>
            )}
            {replies.map((reply) => (
              <Box key={reply.id} sx={{ mb: 1 }}>
                <CommentItem
                  comment={reply}
                  onDelete={onDelete}
                  onReply={onReply}
                  replyingId={replyingId}
                  refresh={refresh}
                  postId={postId}
                  staffPostId={staffPostId}
                  grantId={grantId}
                  targetId={targetId}
                  onReplyPosted={onReplyPosted}
                  isReply={true}
                  userId={userId}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function PostList({
  comments,
  loading,
  error,
  refresh,
  postId,
  staffPostId,
  grantId,
  targetId, // NEW: Add targetId parameter
  userId,
  renderInput,
}: PostListProps & { renderInput?: React.ReactNode }) {
  console.log(" PostList received comments:", comments.length, "comments");
  console.log(
    " Comment IDs:",
    comments.map((c) => c.id)
  );
  console.log(" Comments data:", comments);

  const [replyingId, setReplyingId] = useState<number | null>(null);
  const { remove } = useDeleteComment(refresh, userId);

  // Upvote state: { [commentId]: upvoteCount }
  const [upvotedIds, setUpvotedIds] = useState<Set<number>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`upvotedComments_${userId}`);
      return new Set(stored ? JSON.parse(stored) : []);
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`upvotedComments_${userId}`);
      setUpvotedIds(new Set(stored ? JSON.parse(stored) : []));
    }
  }, [userId]);

  const [commentsState, setCommentsState] = useState<Comment[]>(comments);
  useEffect(() => {
    console.log(
      " PostList comments prop changed:",
      comments.length,
      "comments"
    );
    console.log(" Comments prop data:", comments);
    setCommentsState(comments);
  }, [comments]);

  // Upvote handler
  const handleUpvote = useCallback(
    async (id: number) => {
      if (upvotedIds.has(id)) return;
      try {
        const result = await upvoteComment(id, userId);
        const newSet = new Set(upvotedIds);
        newSet.add(id);
        setUpvotedIds(newSet);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `upvotedComments_${userId}`,
            JSON.stringify(Array.from(newSet))
          );
        }
        // Update upvote count in local state immediately
        setCommentsState((prev) =>
          prev.map((c) => (c.id === id ? { ...c, upvotes: result.upvotes } : c))
        );
        // Optionally refresh from backend
        // if (typeof refresh === "function") refresh();
      } catch (e) {
        // Optionally show error
      }
    },
    [upvotedIds, userId]
  );

  if (loading) return <div>Loading comments...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (comments.length === 0)
    return <div>No comments yet. Be the first to post!</div>;

  const handleDelete = async (id: number) => {
    await remove(id);
    if (typeof refresh === "function") {
      refresh(); // This will trigger a re-fetch in ForumPage
    }
  };

  const handleReply = (id: number) => {
    setReplyingId(id === replyingId ? null : id);
  };

  // Organize comments into nested structure
  const organizeComments = (comments: Comment[]): Comment[] => {
    const commentMap = new Map<number, Comment>();
    const topLevel: Comment[] = [];

    // First pass: create a map of all comments
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into nested structure
    comments.forEach((comment) => {
      if (!comment.parentId) {
        // Top-level comment
        topLevel.push(commentMap.get(comment.id)!);
      } else {
        // Reply - add to parent's replies
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentMap.get(comment.id)!);
        }
      }
    });

    return topLevel;
  };

  // Use commentsState instead of comments for rendering
  const organizedComments = organizeComments(commentsState);
  console.log(
    " Organized comments:",
    organizedComments.map((c) => ({
      id: c.id,
      replies: c.replies?.length || 0,
      replyIds: c.replies?.map((r) => r.id) || [],
    }))
  );
  const sortedTopLevel = organizedComments
    .slice()
    .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || b.id - a.id);

  // Helper to close reply input after posting
  const handleReplyPosted = () => setReplyingId(null);

  return (
    <>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {sortedTopLevel.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onDelete={handleDelete}
            onReply={handleReply}
            replyingId={replyingId}
            refresh={refresh}
            postId={postId}
            staffPostId={staffPostId}
            grantId={grantId}
            targetId={targetId}
            onReplyPosted={handleReplyPosted}
            isReply={false}
            onUpvote={handleUpvote}
            upvoted={upvotedIds.has(comment.id)}
            upvotes={comment.upvotes || 0}
            userId={userId}
          />
        ))}
      </div>
      {renderInput}
    </>
  );
}
