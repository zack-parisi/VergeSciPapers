"use client";
import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CommentIcon from "@mui/icons-material/Comment";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ForumFeedStaffPostCard from "./ForumFeedStaffPostCard";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface SavedRepostCardProps {
  repost: {
    id: number;
    userId: string;
    createdAt?: string;
    content?: string;
    staffPost: any;
    likeCount?: number;
    liked?: boolean;
    bookmarked?: boolean;
    onOpenForum?: () => void;
    onComment?: () => void;
    onBookmark?: () => void;
    onLike?: () => void;
    onUnbookmark?: (postId: number) => void;
    userFullName?: string;
  };
}

// Helper to linkify URLs in text
function linkify(text: string) {
  if (!text) return null;
  const urlRegex =
    /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.match(urlRegex)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#1976d2",
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const SavedRepostCard: React.FC<SavedRepostCardProps> = ({ repost }) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const router = useRouter();
  const handleBookmark = async () => {
    if (repost.onBookmark) await repost.onBookmark();
    if (repost.onUnbookmark && repost.id !== undefined) {
      await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId: repost.id }),
      });
      repost.onUnbookmark(repost.id);
    }
  };
  if (!repost || !repost.staffPost) return null;
  return (
    <Card
      sx={{
        width: 600,
        minWidth: 600,
        maxWidth: 600,
        borderRadius: 3,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1.5px solid #e3f0fd",
        background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
        display: "flex",
        flexDirection: "column",
        height: "auto",
        mb: 3,
        position: "relative",
      }}
    >
      <CardContent sx={{ pb: 0, width: "100%", px: 5, pt: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Avatar sx={{ mr: 2, bgcolor: "#1976d2", width: 40, height: 40 }}>
            {repost.userFullName
              ? repost.userFullName[0].toUpperCase()
              : repost.userId
                ? repost.userId[0].toUpperCase()
                : "?"}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {repost.userFullName || repost.userId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {repost.createdAt
                ? new Date(repost.createdAt).toLocaleDateString()
                : ""}
            </Typography>
          </Box>
        </Box>
        {/* User's comment/content */}
        {repost.content && (
          <Typography
            variant="body1"
            sx={{
              mb: 2,
              lineHeight: 1.6,
              color: "#333",
              wordWrap: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {linkify(repost.content)}
          </Typography>
        )}
        {/* Embedded staff post - clickable */}
        <Box
          sx={{
            mt: 2,
            width: "100%",
            maxWidth: "100%",
            transition:
              "box-shadow 0.2s, transform 0.18s cubic-bezier(.4,1.5,.6,1)",
            "&:hover": {
              boxShadow: "0 8px 24px rgba(25, 118, 210, 0.10)",
              transform: "scale(1.01)",
            },
            borderRadius: 3,
            zIndex: 1,
            boxSizing: "border-box",
            cursor: "pointer",
          }}
          onClick={() => {
            if (repost.staffPost?.id) {
              router.push(`/home?postId=${repost.staffPost.id}`);
            }
          }}
        >
          <ForumFeedStaffPostCard post={repost.staffPost} />
        </Box>
      </CardContent>
      <Divider />
      {/* Actions */}
      <CardActions sx={{ px: 4, py: 2, minHeight: 48 }}>
        <IconButton
          onClick={repost.onLike}
          sx={{ color: repost.liked ? "#1976d2" : "inherit" }}
        >
          {repost.liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
        <Typography variant="body2" sx={{ mr: 2 }}>
          {repost.likeCount || 0}
        </Typography>
        <IconButton
          onClick={handleBookmark}
          sx={{ color: "#1976d2", background: "#e3f0fd" }}
        >
          <BookmarkIcon />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        {repost.onComment && (
          <IconButton onClick={repost.onComment} size="small" sx={{ mr: 1 }}>
            <CommentIcon />
          </IconButton>
        )}
        {repost.onOpenForum && (
          <Button variant="outlined" onClick={repost.onOpenForum} size="small">
            Open Forum
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default SavedRepostCard;
