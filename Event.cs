namespace Cpt_proje
{
    public class Event
    {
        public int EventId { get; set; }
        public int SessionId { get; set; }
        public long EventTimeMs { get; set; }
        public string EventType { get; set; } = string.Empty; // örn: 'keypress'[cite: 1]
        public int? LinkedTrialId { get; set; }
    }
}
