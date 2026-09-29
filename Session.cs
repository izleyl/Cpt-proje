namespace Cpt_proje
{
    public class Session
    {
        public int SessionId { get; set; }
        public string ParticipantId { get; set; } = string.Empty;
        public long StartedAt { get; set; }
        public long? EndedAt { get; set; }
        public int TotalTrials { get; set; }
    }
}
