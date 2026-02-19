import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Image from "next/image";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CommentIcon from "@mui/icons-material/Comment";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Chip from "@mui/material/Chip";

interface ForumFeedStaffPostCardProps {
  post: {
    id: number;
    title: string;
    createdAt?: string;
    citedByCount?: number;
    abstract?: string;
    doi?: string;
    linkId?: string;
    authors?: string[];
    subfields?: string[];
    likeCount?: number;
    liked?: boolean;
    bookmarked?: boolean;
    onOpenForum?: () => void;
    onComment?: () => void;
    onBookmark?: () => void;
    onLike?: () => void;
  };
}

const ForumFeedStaffPostCard: React.FC<ForumFeedStaffPostCardProps> = ({
  post,
}) => {
  if (!post) return null;
  return (
    <Card
      sx={{
        width: "100%",
        maxWidth: 950,
        minWidth: 0,
        borderRadius: 3,
        boxShadow: "0 2px 12px rgba(25, 118, 210, 0.07)",
        border: "1.5px solid #e3f0fd",
        background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
        display: "flex",
        flexDirection: "column",
        height: "auto",
        mb: 2,
      }}
    >
      <CardContent sx={{ pb: 0, width: "100%", px: 5, pt: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Avatar
            sx={{
              mr: 2,
              bgcolor: "#1976d2",
              width: 44,
              height: 44,
              border: "2px solid #fff",
            }}
          >
            <Image
              src="/vergesci_logo.jpeg"
              alt="VergeSci Logo"
              width={32}
              height={32}
              style={{ borderRadius: 8 }}
            />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, fontSize: 18, color: "#1976d2" }}
              style={{ color: "#000" }}
            >
              VergeSci
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {post.createdAt
                ? new Date(post.createdAt).toLocaleDateString()
                : ""}
            </Typography>
          </Box>
        </Box>
        {/* Title */}
        <Typography
          variant="h6"
          sx={{ mb: 1, fontWeight: 600, color: "#1976d2" }}
        >
          {post.title}
        </Typography>
        {/* Authors */}
        {post.authors && post.authors.length > 0 && (
          <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label="Authors"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <Typography variant="body2" color="text.secondary">
              {post.authors.join(", ")}
            </Typography>
          </Box>
        )}
        {/* Subfields */}
        {post.subfields && post.subfields.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {post.subfields.map((subfield) => {
              // Type guard for subfield object
              const isObj =
                typeof subfield === "object" &&
                subfield !== null &&
                "id" in subfield &&
                "name" in subfield;
              return (
                <Chip
                  key={isObj ? (subfield as { id: any }).id : subfield}
                  label={isObj ? (subfield as { name: any }).name : subfield}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: "#1976d2",
                    color: "#1976d2",
                    "&:hover": {
                      borderColor: "#1565c0",
                      backgroundColor: "rgba(25, 118, 210, 0.04)",
                    },
                  }}
                />
              );
            })}
          </Box>
        )}
        {/* Publication Date & Cited By Count */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          {post.createdAt && (
            <Typography variant="body2" color="text.secondary">
              Published: {new Date(post.createdAt).toLocaleDateString()}
            </Typography>
          )}
          {post.citedByCount !== undefined && (
            <Typography variant="body2" color="text.secondary">
              Cited by: {post.citedByCount}
            </Typography>
          )}
        </Box>
        {/* Abstract */}
        {post.abstract && (
          <Typography
            variant="body2"
            sx={{ mb: 2, color: "#333", lineHeight: 1.6 }}
          >
            {post.abstract}
          </Typography>
        )}
        {/* DOI and Link ID */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          {post.doi && (
            <Button
              variant="outlined"
              color="primary"
              size="small"
              href={post.doi}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: "none", fontWeight: 600, minWidth: 80 }}
            >
              DOI
            </Button>
          )}
          {post.linkId && (
            <Button
              variant="outlined"
              color="primary"
              size="small"
              href={(() => {
                // Helper function to clean the linkId URL
                const getCleanLink = (linkId: string) => {
                  // Handle the case where linkId already contains a full URL
                  if (linkId.startsWith("openalex:https://openalex.org/")) {
                    // Extract just the ID part after the last slash
                    const idPart = linkId.split("/").pop();
                    return `https://openalex.org/${idPart}`;
                  }

                  if (linkId.startsWith("openalex:")) {
                    return linkId.replace("openalex:", "https://openalex.org/");
                  }

                  return linkId;
                };
                return getCleanLink(post.linkId);
              })()}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: "none", fontWeight: 600, minWidth: 80 }}
            >
              Source
            </Button>
          )}
        </Box>
      </CardContent>
      <Divider sx={{ m: 0 }} />
      {/* Actions */}
      <CardActions sx={{ mt: "auto", px: 5, py: 2.5, gap: 2 }}>
        <IconButton
          onClick={post.onLike}
          sx={{
            color: post.liked ? "#1976d2" : "#b0b8c1",
            background: post.liked ? "#e3f0fd" : "transparent",
            borderRadius: 2,
            transition: "background 0.2s, color 0.2s",
            mr: 0.5,
            "&:hover": { background: "#e3f0fd", color: "#1976d2" },
          }}
        >
          {post.liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
        <Typography
          variant="body2"
          sx={{
            mr: 2,
            minWidth: 18,
            textAlign: "center",
            color: "#1976d2",
            fontWeight: 600,
          }}
        >
          {post.likeCount || 0}
        </Typography>
        <IconButton
          onClick={post.onBookmark}
          sx={{
            color: post.bookmarked ? "#1976d2" : "#b0b8c1",
            background: post.bookmarked ? "#e3f0fd" : "transparent",
            borderRadius: 2,
            transition: "background 0.2s, color 0.2s",
            mr: 0.5,
            "&:hover": { background: "#e3f0fd", color: "#1976d2" },
          }}
        >
          {post.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        </IconButton>
        <Box sx={{ flex: 1 }} />
        {post.onComment && (
          <IconButton
            onClick={post.onComment}
            size="small"
            sx={{
              mr: 1,
              color: "#1976d2",
              background: "#e3f0fd",
              borderRadius: 2,
              "&:hover": { background: "#d2e6fa" },
            }}
          >
            <CommentIcon />
          </IconButton>
        )}
        {post.onOpenForum && (
          <Button
            variant="outlined"
            onClick={post.onOpenForum}
            size="small"
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              borderColor: "#1976d2",
              color: "#1976d2",
              px: 2,
              "&:hover": { background: "#e3f0fd", borderColor: "#1976d2" },
            }}
          >
            Open Forum
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default ForumFeedStaffPostCard;
