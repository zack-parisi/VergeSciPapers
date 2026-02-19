import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import ResearchInterestsModal from "../components/ResearchInterestsModal";
import { useResearchInterests } from "../hooks/useResearchInterests";
import { useSession } from "next-auth/react";
import { InstitutionAutocomplete } from "../components/InstitutionAutocomplete";

export interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  initialValues: {
    id?: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    student?: boolean;
    degree?: string;
    intendedDegree?: string;
    about?: string;
    labAffiliation?: string;
    currentProjects?: string;    undergraduateStudent?: boolean;
    graduateStudent?: boolean;
    researchTechnician?: boolean;
    postdoctoralScholar?: boolean;
    principalInvestigator?: boolean;
    industryProfessional?: boolean;
    medicalStudent?: boolean;
    resident?: boolean;
    physician?: boolean;
    clinician?: boolean;
    otherRole?: string;
  };
  onSave: (values: any) => void;
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  open,
  onClose,
  initialValues,
  onSave,
}) => {
  const { data: session } = useSession();
  const {
    interests: userInterests,
    updateInterests,
    removeInterest,
    fetchInterests,
  } = useResearchInterests();
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [firstName, setFirstName] = useState(initialValues.firstName || "");
  const [lastName, setLastName] = useState(initialValues.lastName || "");
  const [school, setSchool] = useState(initialValues.school || "");
  const [undergraduateStudent, setUndergraduateStudent] = useState(
    initialValues.undergraduateStudent || false
  );
  const [graduateStudent, setGraduateStudent] = useState(
    initialValues.graduateStudent || false
  );
  const [researchTechnician, setResearchTechnician] = useState(
    initialValues.researchTechnician || false
  );
  const [postdoctoralScholar, setPostdoctoralScholar] = useState(
    initialValues.postdoctoralScholar || false
  );
  const [principalInvestigator, setPrincipalInvestigator] = useState(
    initialValues.principalInvestigator || false
  );
  const [industryProfessional, setIndustryProfessional] = useState(
    initialValues.industryProfessional || false
  );
  const [medicalStudent, setMedicalStudent] = useState(
    initialValues.medicalStudent || false
  );
  const [resident, setResident] = useState(initialValues.resident || false);
  const [physician, setPhysician] = useState(initialValues.physician || false);
  const [clinician, setClinician] = useState(initialValues.clinician || false);
  const [otherRole, setOtherRole] = useState(initialValues.otherRole || "");
  const [otherChecked, setOtherChecked] = useState(!!initialValues.otherRole);
  const [degree, setDegree] = useState(initialValues.degree || "");
  const [intendedDegree, setIntendedDegree] = useState(
    initialValues.intendedDegree || ""
  );

  const [about, setAbout] = useState(initialValues.about || "");
  const [labAffiliation, setLabAffiliation] = useState(initialValues.labAffiliation || "");
  const [currentProjects, setCurrentProjects] = useState(initialValues.currentProjects || "");  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const requiredFields = [
    "firstName",
    "lastName",
    "school",
    "degree",
    "intendedDegree", // one of these will be required depending on undergrad
  ];

  // Helper: at least one status checked
  const atLeastOneStatus = [
    undergraduateStudent,
    graduateStudent,
    researchTechnician,
    postdoctoralScholar,
    principalInvestigator,
    industryProfessional,
    medicalStudent,
    resident,
    physician,
    clinician,
    otherChecked,
  ].some(Boolean);

  // Helper: all required fields filled
  const allRequiredFilled =
    firstName.trim() &&
    lastName.trim() &&
    school.trim() &&
    (undergraduateStudent ? intendedDegree.trim() : degree.trim()) &&
    atLeastOneStatus;

  // Sync state with initialValues when dialog opens or initialValues change
  React.useEffect(() => {
    if (open) {
      setFirstName(initialValues.firstName || "");
      setLastName(initialValues.lastName || "");
      setSchool(initialValues.school || "");
      setUndergraduateStudent(initialValues.undergraduateStudent || false);
      setGraduateStudent(initialValues.graduateStudent || false);
      setResearchTechnician(initialValues.researchTechnician || false);
      setPostdoctoralScholar(initialValues.postdoctoralScholar || false);
      setPrincipalInvestigator(initialValues.principalInvestigator || false);
      setIndustryProfessional(initialValues.industryProfessional || false);
      setMedicalStudent(initialValues.medicalStudent || false);
      setResident(initialValues.resident || false);
      setPhysician(initialValues.physician || false);
      setClinician(initialValues.clinician || false);
      setOtherRole(initialValues.otherRole || "");
      setOtherChecked(!!initialValues.otherRole);
      setDegree(initialValues.degree || "");
      setIntendedDegree(initialValues.intendedDegree || "");
      setAbout(initialValues.about || "");
      setLabAffiliation(initialValues.labAffiliation || "");
      setCurrentProjects(initialValues.currentProjects || "");
      // Fetch user's research interests when dialog opens
      fetchInterests();
    }
  }, [open, initialValues, fetchInterests]);

  const handleClose = () => {
    // Prevent close if not all required fields are filled
    if (!loading && allRequiredFilled) onClose();
  };

  const handleSave = async () => {
    if (!allRequiredFilled) {
      setError(
        "Please fill all required fields and select at least one status."
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          school,
          undergraduateStudent,
          graduateStudent,
          researchTechnician,
          postdoctoralScholar,
          principalInvestigator,
          industryProfessional,
          medicalStudent,
          resident,
          physician,
          clinician,
          otherRole: otherChecked ? otherRole : "",
          degree,
          intendedDegree,
          about,
          labAffiliation,
          currentProjects,        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update profile");
        setLoading(false);
        return;
      }
      onSave(data.user);
      onClose();
      setLoading(false);
    } catch (e) {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { zIndex: 5000 } }}
    >
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
      >
        <TextField
          label="First Name *"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          fullWidth
        />
        <TextField
          label="Last Name *"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          fullWidth
        />
        <InstitutionAutocomplete
          label="School"
          value={school}
          onChange={setSchool}
          placeholder="Search for your institution..."
          required
          fullWidth
        />
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Status:
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "repeat(3, 1fr)",
                md: "repeat(4, 1fr)",
              },
              gap: 1,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={undergraduateStudent}
                  onChange={(e) => {
                    setUndergraduateStudent(e.target.checked);
                    if (e.target.checked) setGraduateStudent(false);
                  }}
                />
              }
              label="Undergraduate Student"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={graduateStudent}
                  onChange={(e) => {
                    setGraduateStudent(e.target.checked);
                    if (e.target.checked) setUndergraduateStudent(false);
                  }}
                />
              }
              label="Graduate Student"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={researchTechnician}
                  onChange={(e) => setResearchTechnician(e.target.checked)}
                />
              }
              label="Research Technician"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={postdoctoralScholar}
                  onChange={(e) => setPostdoctoralScholar(e.target.checked)}
                />
              }
              label="Postdoctoral Scholar"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={principalInvestigator}
                  onChange={(e) => setPrincipalInvestigator(e.target.checked)}
                />
              }
              label="Principal Investigator"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={industryProfessional}
                  onChange={(e) => setIndustryProfessional(e.target.checked)}
                />
              }
              label="Industry Professional"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={medicalStudent}
                  onChange={(e) => setMedicalStudent(e.target.checked)}
                />
              }
              label="Medical Student"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={resident}
                  onChange={(e) => setResident(e.target.checked)}
                />
              }
              label="Resident"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={physician}
                  onChange={(e) => setPhysician(e.target.checked)}
                />
              }
              label="Physician"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={clinician}
                  onChange={(e) => setClinician(e.target.checked)}
                />
              }
              label="Clinician"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={otherChecked}
                  onChange={(e) => setOtherChecked(e.target.checked)}
                />
              }
              label="Other"
            />
          </Box>
          {otherChecked && (
            <TextField
              label="Other (please specify)"
              value={otherRole}
              onChange={(e) => setOtherRole(e.target.value)}
              fullWidth
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        {undergraduateStudent ? (
          <TextField
            label="Intended Degree *"
            value={intendedDegree}
            onChange={(e) => setIntendedDegree(e.target.value)}
            fullWidth
          />
        ) : (
          <TextField
            label="Degree *"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            fullWidth
          />
        )}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Research Interests
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setShowInterestsModal(true)}
            sx={{ mb: 1 }}
          >
            {userInterests.length > 0
              ? `Edit Research Interests (${userInterests.length} selected)`
              : "Add Research Interests"}
          </Button>
          {userInterests.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {userInterests.map((interest) => (
                <Chip
                  key={interest.id}
                  label={interest.name}
                  color="primary"
                  variant="outlined"
                  size="small"
                  onDelete={async () => {
                    try {
                      const success = await removeInterest(
                        interest.name
                      );
                      if (success) {
                        setSuccess(`${interest.name} removed from interests`);
                        setTimeout(() => setSuccess(null), 3000);
                      }
                    } catch (error) {
                      console.error("Error removing interest:", error);
                      setError("Failed to remove interest");
                      setTimeout(() => setError(null), 3000);
                    }
                  }}
                  deleteIcon={
                    <IconButton
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const success = await removeInterest(
                            interest.name
                          );
                          if (success) {
                            setSuccess(
                              `${interest.name} removed from interests`
                            );
                            setTimeout(() => setSuccess(null), 3000);
                          }
                        } catch (error) {
                          console.error("Error removing interest:", error);
                          setError("Failed to remove interest");
                          setTimeout(() => setError(null), 3000);
                        }
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                />
              ))}
            </Box>
          )}
        </Box>

        <TextField
          label="About (Optional)"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          helperText="Tell us about yourself and your research interests"
        />

        <TextField
          label="Lab Affiliation (Optional)"
          value={labAffiliation}
          onChange={(e) => setLabAffiliation(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          inputProps={{ maxLength: 2000 }}
          helperText={`${labAffiliation.length}/2000 characters - Describe your lab or research group affiliation`}
        />

        <TextField
          label="Current Project(s) (Optional)"
          value={currentProjects}
          onChange={(e) => setCurrentProjects(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          inputProps={{ maxLength: 2000 }}
          helperText={`${currentProjects.length}/2000 characters - Describe your current research projects`}
        />        {error && <div style={{ color: "#d32f2f", marginTop: 8 }}>{error}</div>}
        {success && (
          <div style={{ color: "#2e7d32", marginTop: 8 }}>{success}</div>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          color="secondary"
          disabled={loading || !allRequiredFilled}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !allRequiredFilled}
          startIcon={loading ? <CircularProgress size={18} /> : null}
        >
          Save
        </Button>
      </DialogActions>

      {/* Research Interests Modal */}
      <ResearchInterestsModal
        open={showInterestsModal}
        onClose={() => setShowInterestsModal(false)}
        onSave={async (interests) => {
          const subfieldIds = interests.map((interest) => interest.name);
          await updateInterests(subfieldIds);
          setShowInterestsModal(false);
        }}
        initialInterests={userInterests}
        isFirstTime={false}
      />
    </Dialog>
  );
};

export default EditProfileDialog;
