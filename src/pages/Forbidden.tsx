import { Link } from "react-router-dom";
import { Result, Button } from "antd";

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Result
        status="403"
        title="403"
        subTitle="You do not have permission to view this page."
        extra={
          <Link to="/">
            <Button type="primary">Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  );
}
