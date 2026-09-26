ALTER TABLE "Message" ADD CONSTRAINT "Message_attachments_relation_marker_fkey"
FOREIGN KEY ("id") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
