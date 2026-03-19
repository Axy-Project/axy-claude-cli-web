class NotificationManager {
  private enabled = false

  /** Request notification permission */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      this.enabled = true
      return true
    }
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    this.enabled = result === 'granted'
    return this.enabled
  }

  /** Check if notifications are enabled */
  get isEnabled(): boolean {
    return this.enabled && 'Notification' in window && Notification.permission === 'granted'
  }

  /** Check if page is currently visible */
  private isPageHidden(): boolean {
    return document.hidden
  }

  /** Send a notification (only when page is hidden/unfocused) */
  notify(title: string, options?: { body?: string; tag?: string; onClick?: () => void }) {
    if (!this.isEnabled || !this.isPageHidden()) return

    const notification = new Notification(title, {
      body: options?.body,
      tag: options?.tag, // prevents duplicate notifications with same tag
      icon: '/logo.png',
      silent: false,
    })

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus()
        options.onClick!()
        notification.close()
      }
    }

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000)
  }

  /** Notify task completion */
  notifyTaskComplete(taskTitle: string, status: 'completed' | 'failed') {
    this.notify(
      status === 'completed' ? 'Task Completed' : 'Task Failed',
      { body: taskTitle, tag: `task-${taskTitle}` }
    )
  }

  /** Notify chat response ready */
  notifyChatReady(sessionTitle?: string) {
    this.notify('Claude responded', {
      body: sessionTitle || 'Your message got a response',
      tag: 'chat-response',
    })
  }
}

export const notifications = new NotificationManager()
