import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { ConnectionView } from "../community-api";
import {
  cancelPlayerConnection,
  requestPlayerConnection,
  respondToPlayerConnection,
} from "../community-api";
import { Button, Pill } from "./ui";
import { useMoveitTheme } from "../theme";

export function ConnectionControls({
  playerId,
  connection,
  onChanged,
}: {
  playerId: string;
  connection: ConnectionView | null;
  onChanged: () => Promise<void>;
}) {
  const { colors } = useMoveitTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The connection action failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (connection?.status === "accepted") {
    return <Pill label="Connected" selected />;
  }

  if (connection?.status === "rejected" && connection.direction === "incoming") {
    return <Pill label="Request declined" />;
  }

  if (busy) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Updating connection" style={{ minHeight: 42, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {connection?.status === "pending" && connection.direction === "incoming" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Accept"
              onPress={() => void run(() => respondToPlayerConnection(connection.id, "accepted"))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Decline"
              variant="secondary"
              onPress={() => void run(() => respondToPlayerConnection(connection.id, "rejected"))}
            />
          </View>
        </View>
      ) : connection?.status === "pending" ? (
        <Button
          label="Cancel request"
          variant="secondary"
          onPress={() => void run(() => cancelPlayerConnection(connection.id))}
        />
      ) : connection?.status === "rejected" ? (
        <Button
          label="Send request again"
          onPress={() => void run(() => requestPlayerConnection(playerId))}
        />
      ) : (
        <Button
          label="Connect"
          onPress={() => void run(() => requestPlayerConnection(playerId))}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
