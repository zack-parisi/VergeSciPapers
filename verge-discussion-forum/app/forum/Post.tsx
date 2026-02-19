type PostProps = {
  userId: string;
  userFullName?: string;
  content: string;
};

export default function Post({ userId, userFullName, content }: PostProps) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <div className="font-semibold text-blue-700">
        {userFullName || userId}
      </div>
      <div className="mt-2 text-gray-800">{content}</div>
    </div>
  );
}
