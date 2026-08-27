import type { Metadata } from "next";
import Image from "next/image";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { Button } from "@/components/ui/Button";
import { BookOpenIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { createLoginHref } from "@/lib/auth-redirect";
import { getCurrentUserProfile } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Orgs | Project Ve",
  description: "Bring Project VE to your world with lessons, missions and rewards for your organisation.",
};

function displayName(profileName: string | null | undefined) {
  return profileName && !profileName.includes("@") ? profileName : "Learner";
}

function SignedOutTopChrome() {
  return <LearnerTopChrome active="Orgs" displayName="Learner" />;
}

export default async function OrgModePage() {
  const { user, profile } = await getCurrentUserProfile();
  const createHref = user ? "/org/create" : createLoginHref("/org/create");
  const myOrgsHref = user ? "/org/my" : createLoginHref("/org/my");
  const name = displayName(profile?.display_name);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      {user ? (
        <LearnerTopChrome
          active="Orgs"
          avatarUrl={profile?.avatar_url}
          displayName={name}
          email={user.email}
        />
      ) : (
        <SignedOutTopChrome />
      )}

      <section className="learner-page orgs-landing">
        <h1 className="sr-only">Orgs</h1>
        <div className="orgs-landing__hero">
          <p className="orgs-landing__eyebrow">Introducing Orgs</p>
          <h1 className="orgs-landing__title">
            <span className="orgs-landing__title-mobile">
              Project Ve
              <br />
              <span className="orgs-landing__title-phrase">
                for <em>your people.</em>
              </span>
            </span>
            <span className="orgs-landing__title-desktop">
              Project Ve for <em>your people.</em>
            </span>
          </h1>
          <p className="orgs-landing__copy">
            Bring Project VE to your world. Design your own lessons, missions, and rewards for your
            organisation, community, or family.
          </p>
          <div className="orgs-landing__preview-art" aria-hidden="true">
            <div className="orgs-landing__photo-card">
              <div className="orgs-landing__browser-bar">
                <span className="orgs-landing__lock" />
                <span>Private Workspace</span>
                <span className="orgs-landing__dots" />
              </div>
              <div className="orgs-landing__photo-stage">
                <Image
                  alt=""
                  className="orgs-landing__photo"
                  height={360}
                  src="/images/org-landing-stitch-photo.jpg"
                  width={480}
                />
                <div className="orgs-landing__photo-caption">
                  <span>Acme Corp</span>
                  <strong>Design Team Retreat</strong>
                </div>
              </div>
              <div className="orgs-landing__mini-card orgs-landing__mini-card--first">
                <span className="orgs-landing__mini-icon">
                  <BookOpenIcon className="size-3" />
                </span>
                <span>
                  <small className="orgs-landing__mini-pill">Required Lesson</small>
                  <strong>Volunteer Induction</strong>
                  <i className="orgs-landing__mini-progress" />
                </span>
              </div>
              <div className="orgs-landing__mini-card orgs-landing__mini-card--second">
                <span className="orgs-landing__mini-symbol orgs-landing__mini-symbol--mission" />
                <span>
                  <small>Mission</small>
                  First Aid Drill
                </span>
              </div>
              <div className="orgs-landing__mini-card orgs-landing__mini-card--third">
                <span className="orgs-landing__mini-symbol orgs-landing__mini-symbol--resource" />
                <span>
                  <small>Resource</small>
                  Leadership Training
                </span>
              </div>
              <div className="orgs-landing__mini-card orgs-landing__mini-card--fourth">
                <span className="orgs-landing__mini-symbol orgs-landing__mini-symbol--active" />
                <span>
                  <small>Active Mission</small>
                  School Prefect Training
                  <b className="orgs-landing__mini-members">+42 others</b>
                </span>
              </div>
              <div className="orgs-landing__mini-card orgs-landing__mini-card--fifth">
                <span className="orgs-landing__mini-symbol orgs-landing__mini-symbol--reward" />
                <span>
                  <small>
                    XP Reward <b>+500 XP</b>
                  </small>
                  Community Values Series
                </span>
              </div>
            </div>
          </div>
          <div className="orgs-landing__actions">
            <Button className="h-12 text-sm font-black" href={createHref}>
              Create Org
              <ChevronRightIcon className="ml-2 h-4 w-4" />
            </Button>
            <Button className="h-12 text-sm font-black" href={myOrgsHref} variant="outline">
              My Orgs
            </Button>
          </div>
        </div>
      </section>

      {user ? <BottomNav active="Orgs" /> : null}
    </main>
  );
}
