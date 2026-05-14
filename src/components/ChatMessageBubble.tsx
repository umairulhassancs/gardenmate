import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { toDateSafe } from '../utils/dateUtils';

function formatMessageTime(timestamp: unknown): string {
  const d = toDateSafe(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface ChatMessageBubbleProps {
  text: string;
  isMyMessage: boolean;
  createdAt?: unknown;
  read?: boolean;
  status?: string;
}

export default function ChatMessageBubble({ text, isMyMessage, createdAt, read, status }: ChatMessageBubbleProps) {
  const resolvedStatus = status || (read ? 'read' : 'sent');
  const showDoubleCheck = resolvedStatus === 'read';
  const checkColor = isMyMessage ? (showDoubleCheck ? '#22c55e' : 'rgba(255,255,255,0.85)') : 'transparent';

  return (
    <View style={[styles.bubble, isMyMessage ? styles.sent : styles.received]}>
      <Text style={[styles.text, { color: isMyMessage ? '#fff' : '#000' }]}>{text}</Text>
      <View style={styles.footer}>
        <Text style={[styles.time, { color: isMyMessage ? 'rgba(255,255,255,0.9)' : '#888' }]}>
          {formatMessageTime(createdAt)}
        </Text>
        {isMyMessage && (
          <View style={styles.checkContainer}>
            <Feather name="check" size={12} color={checkColor} />
            {showDoubleCheck && (
              <Feather name="check" size={12} color={checkColor} style={styles.checkSecond} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 4,
    maxWidth: '80%',
  },
  sent: {
    alignSelf: 'flex-end',
    backgroundColor: '#f97316',
    borderBottomRightRadius: 4,
  },
  received: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f1f1',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  time: {
    fontSize: 10,
  },
  checkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  checkSecond: {
    marginLeft: -6,
  },
});
