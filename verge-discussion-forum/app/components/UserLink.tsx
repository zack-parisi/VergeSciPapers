import Link from "next/link";
import React from "react";

interface UserLinkProps {
  userId: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const UserLink: React.FC<UserLinkProps> = ({
  userId,
  children,
  className,
  style,
}) => {
  return (
    <Link
      href={`/profile/${userId}`}
      className={className}
      style={{ cursor: "pointer", textDecoration: "none", ...style }}
      aria-label={`View profile of user ${userId}`}
    >
      {children}
    </Link>
  );
};

export default UserLink;
