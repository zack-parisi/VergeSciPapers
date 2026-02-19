import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import GrantCard from "../grants/GrantCard";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useRouter } from "next/navigation";

interface BookmarkedGrantsSectionProps {
  savedGrants: any[];
  allCategoryPostIds: number[];
  onPreview: (grantId: string) => void;
  onOpenForum?: (grantId: string) => void;
  loading: boolean;
  activeAddCategoryId: number | null;
  toggledCategoryPostIds: Set<number | string>;
  setToggledCategoryPostIds: React.Dispatch<
    React.SetStateAction<Set<number | string>>
  >;
  addGrantToCategory: (
    categoryId: number,
    grantId: string,
    grantData?: any
  ) => Promise<void>;
  fetchCategories: () => void;
  onUnbookmark?: (grantId: string) => void;
  onRemoveFromCategory?: (grantId: string) => void;
}

const BookmarkedGrantsSection: React.FC<BookmarkedGrantsSectionProps> = ({
  savedGrants,
  allCategoryPostIds,
  onPreview,
  onOpenForum,
  loading,
  activeAddCategoryId,
  toggledCategoryPostIds,
  setToggledCategoryPostIds,
  addGrantToCategory,
  fetchCategories,
  onUnbookmark,
  onRemoveFromCategory,
}) => {
  const router = useRouter();
  const unsortedSavedGrants = savedGrants.filter(
    (grant) =>
      !allCategoryPostIds.includes(grant.id) &&
      (!activeAddCategoryId || !toggledCategoryPostIds.has(grant.id))
  );
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width:600px)").matches;
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Loading grants...</Typography>
      </Box>
    );
  }
  if (unsortedSavedGrants.length === 0) return null;
  return (
    <Box sx={{ mt: 4, width: "100%", minWidth: 0 }}>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, mb: 2, color: "#1976d2", pl: 4 }}
      >
        Bookmarked Grants
      </Typography>
      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          gap: isMobile ? 2 : 4,
          overflowX: "auto",
          overflowY: "visible",
          pb: 2,
          pl: 4,
          pr: 8, // Increased right padding to ensure full visibility
          scrollbarWidth: "auto",
          "&::-webkit-scrollbar": {
            height: 12,
            backgroundColor: "#f1f1f1",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#c1c1c1",
            borderRadius: 4,
            "&:hover": {
              backgroundColor: "#a8a8a8",
            },
          },
        }}
      >
        {unsortedSavedGrants.map((grant) => {
          const showAdd =
            activeAddCategoryId && !toggledCategoryPostIds.has(grant.id);
          const showRemove =
            activeAddCategoryId && toggledCategoryPostIds.has(grant.id);
          return (
            <Box
              key={grant.id}
              sx={{
                width: isMobile ? 320 : 600,
                minWidth: isMobile ? 320 : 600,
                maxWidth: isMobile ? 320 : 600,
                flexShrink: 0,
                position: "relative",
              }}
            >
              <GrantCard
                grant={grant}
                onComment={() => onPreview(grant.id)}
                onOpenForum={
                  onOpenForum ? () => onOpenForum(grant.id) : undefined
                }
                onUnbookmark={onUnbookmark}
                initialBookmarked={true}
                headerIcons={
                  showAdd ? (
                    <IconButton
                      size="small"
                      sx={{
                        bgcolor: "#e3f0fd",
                        color: "#1976d2",
                        boxShadow: 1,
                      }}
                      onClick={async () => {
                        await addGrantToCategory(
                          activeAddCategoryId,
                          grant.id,
                          grant
                        );
                        setToggledCategoryPostIds((prev) => {
                          const next = new Set(prev);
                          next.add(grant.id);
                          return next;
                        });
                        fetchCategories();
                      }}
                    >
                      <AddIcon />
                    </IconButton>
                  ) : showRemove ? (
                    <IconButton
                      size="small"
                      sx={{
                        bgcolor: "#fbe9e7",
                        color: "#d32f2f",
                        boxShadow: 1,
                      }}
                      onClick={async () => {
                        if (onRemoveFromCategory) {
                          await onRemoveFromCategory(grant.id);
                        }
                        setToggledCategoryPostIds((prev) => {
                          const next = new Set(prev);
                          next.delete(grant.id);
                          return next;
                        });
                        fetchCategories();
                      }}
                    >
                      <RemoveIcon />
                    </IconButton>
                  ) : undefined
                }
              />
            </Box>
          );
        })}
        {/* Spacer to ensure full visibility of the last post */}
        <Box
          sx={{
            width: isMobile ? 20 : 40,
            minWidth: isMobile ? 20 : 40,
            flexShrink: 0,
          }}
        />
      </Box>
    </Box>
  );
};

export default BookmarkedGrantsSection;
